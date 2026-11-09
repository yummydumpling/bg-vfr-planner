/**
 * World Magnetic Model evaluator (spherical-harmonic synthesis).
 *
 * Implemented from the equations in the WMM technical report
 * (NOAA NCEI / BGS): geodetic → geocentric conversion, Schmidt
 * semi-normalised associated Legendre functions, field synthesis in
 * spherical coordinates, then rotation back to the ellipsoidal frame.
 */
import {
  WMM2025_COEFFICIENTS,
  WMM2025_EPOCH,
  WMM2025_NMAX,
  WMM2025_VALID_UNTIL,
} from './wmm2025.coef';

const DEG = Math.PI / 180;
/** WGS-84 ellipsoid. */
const WGS84_A_KM = 6378.137;
const WGS84_F = 1 / 298.257223563;
const WGS84_E2 = WGS84_F * (2 - WGS84_F);
/** Geomagnetic reference radius (km). */
const REF_RADIUS_KM = 6371.2;

export interface MagneticField {
  /** North component (nT) */
  x: number;
  /** East component (nT) */
  y: number;
  /** Down component (nT) */
  z: number;
  /** Declination / magnetic variation in degrees, East positive. */
  declination: number;
  /** Inclination (dip) in degrees, down positive. */
  inclination: number;
  /** True when the date is outside the model's validity window. */
  outsideValidity: boolean;
}

const N = WMM2025_NMAX;
const size = N + 1;
const G = Array.from({ length: size }, () => new Float64Array(size));
const H = Array.from({ length: size }, () => new Float64Array(size));
const GDOT = Array.from({ length: size }, () => new Float64Array(size));
const HDOT = Array.from({ length: size }, () => new Float64Array(size));
for (const [n, m, g, h, gd, hd] of WMM2025_COEFFICIENTS) {
  G[n][m] = g;
  H[n][m] = h;
  GDOT[n][m] = gd;
  HDOT[n][m] = hd;
}

/**
 * Schmidt semi-normalised associated Legendre functions P[n][m](cos θ)
 * and their derivatives with respect to colatitude θ.
 */
function legendre(cosTheta: number, sinTheta: number) {
  const P = Array.from({ length: size }, () => new Float64Array(size));
  const dP = Array.from({ length: size }, () => new Float64Array(size));
  P[0][0] = 1;
  dP[0][0] = 0;
  for (let n = 1; n <= N; n++) {
    // Diagonal terms
    if (n === 1) {
      P[1][1] = sinTheta;
      dP[1][1] = cosTheta;
    } else {
      const k = Math.sqrt((2 * n - 1) / (2 * n));
      P[n][n] = k * sinTheta * P[n - 1][n - 1];
      dP[n][n] = k * (sinTheta * dP[n - 1][n - 1] + cosTheta * P[n - 1][n - 1]);
    }
    // Off-diagonal terms (m < n)
    for (let m = 0; m < n; m++) {
      const a = Math.sqrt(n * n - m * m);
      const b = n >= 2 ? Math.sqrt((n - 1) * (n - 1) - m * m) : 0;
      const pnm2 = n >= 2 ? P[n - 2][m] : 0;
      const dpnm2 = n >= 2 ? dP[n - 2][m] : 0;
      P[n][m] = ((2 * n - 1) * cosTheta * P[n - 1][m] - b * pnm2) / a;
      dP[n][m] =
        ((2 * n - 1) * (cosTheta * dP[n - 1][m] - sinTheta * P[n - 1][m]) - b * dpnm2) / a;
    }
  }
  return { P, dP };
}

/**
 * Evaluate the main geomagnetic field.
 * @param latDeg geodetic latitude (deg)
 * @param lonDeg longitude (deg, East positive)
 * @param altitudeKm height above the WGS-84 ellipsoid (km)
 * @param decimalYear e.g. 2026.85
 */
export function magneticField(
  latDeg: number,
  lonDeg: number,
  altitudeKm: number,
  decimalYear: number,
): MagneticField {
  const phi = latDeg * DEG;
  const lambda = lonDeg * DEG;
  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);

  // Geodetic → geocentric spherical
  const rc = WGS84_A_KM / Math.sqrt(1 - WGS84_E2 * sinPhi * sinPhi);
  const p = (rc + altitudeKm) * cosPhi;
  const zc = (rc * (1 - WGS84_E2) + altitudeKm) * sinPhi;
  const r = Math.hypot(p, zc);
  const phiC = Math.asin(zc / r); // geocentric latitude

  const cosTheta = Math.sin(phiC);
  const sinTheta = Math.cos(phiC);
  const { P, dP } = legendre(cosTheta, sinTheta);

  const dt = decimalYear - WMM2025_EPOCH;
  let xs = 0;
  let ys = 0;
  let zs = 0;
  for (let n = 1; n <= N; n++) {
    const ratio = Math.pow(REF_RADIUS_KM / r, n + 2);
    for (let m = 0; m <= n; m++) {
      const g = G[n][m] + dt * GDOT[n][m];
      const h = H[n][m] + dt * HDOT[n][m];
      const cosM = Math.cos(m * lambda);
      const sinM = Math.sin(m * lambda);
      const gcos = g * cosM + h * sinM;
      // dP/dφ' = -dP/dθ, and X' = -Σ (…) dP/dφ'
      xs += ratio * gcos * dP[n][m];
      ys += ratio * m * (g * sinM - h * cosM) * P[n][m];
      zs -= ratio * (n + 1) * gcos * P[n][m];
    }
  }
  const cosPhiC = Math.cos(phiC);
  ys = Math.abs(cosPhiC) > 1e-10 ? ys / cosPhiC : 0;

  // Rotate from geocentric to ellipsoidal frame
  const psi = phiC - phi;
  const x = xs * Math.cos(psi) - zs * Math.sin(psi);
  const z = xs * Math.sin(psi) + zs * Math.cos(psi);
  const y = ys;

  return {
    x,
    y,
    z,
    declination: Math.atan2(y, x) / DEG,
    inclination: Math.atan2(z, Math.hypot(x, y)) / DEG,
    outsideValidity: decimalYear < WMM2025_EPOCH || decimalYear >= WMM2025_VALID_UNTIL,
  };
}

/** Magnetic variation (declination) in degrees, East positive. */
export function magneticVariation(
  latDeg: number,
  lonDeg: number,
  date: Date = new Date(),
  altitudeKm = 0,
): number {
  return magneticField(latDeg, lonDeg, altitudeKm, toDecimalYear(date)).declination;
}

/** Convert a Date (UTC) to a decimal year, e.g. 1 Jul 2026 → ≈2026.497. */
export function toDecimalYear(date: Date): number {
  const year = date.getUTCFullYear();
  const start = Date.UTC(year, 0, 1);
  const end = Date.UTC(year + 1, 0, 1);
  return year + (date.getTime() - start) / (end - start);
}
