/**
 * Spherical-earth great-circle helpers.
 *
 * A spherical model (mean radius 3440.065 NM) is used: across Bulgaria the
 * difference to the WGS-84 ellipsoid is < 0.5 % in distance and a fraction
 * of a degree in bearing, well inside VFR planning accuracy.
 */

export interface LatLon {
  lat: number;
  lon: number;
}

export const EARTH_RADIUS_NM = 3440.065;
export const NM_IN_M = 1852;
const DEG = Math.PI / 180;

export const toRad = (deg: number) => deg * DEG;
export const toDeg = (rad: number) => rad / DEG;

/** Normalise an angle to [0, 360). */
export function norm360(deg: number): number {
  const r = ((deg % 360) + 360) % 360;
  return r === 0 ? 0 : r; // also turns -0 into 0
}

/** Normalise an angle to (-180, 180]. */
export function norm180(deg: number): number {
  const r = norm360(deg);
  return r > 180 ? r - 360 : r;
}

/** Great-circle distance in nautical miles (haversine). */
export function distanceNm(a: LatLon, b: LatLon): number {
  const φ1 = toRad(a.lat);
  const φ2 = toRad(b.lat);
  const dφ = φ2 - φ1;
  const dλ = toRad(b.lon - a.lon);
  const h = Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
  return 2 * EARTH_RADIUS_NM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial great-circle bearing from a to b, degrees true [0, 360). */
export function initialBearing(a: LatLon, b: LatLon): number {
  const φ1 = toRad(a.lat);
  const φ2 = toRad(b.lat);
  const dλ = toRad(b.lon - a.lon);
  const y = Math.sin(dλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(dλ);
  return norm360(toDeg(Math.atan2(y, x)));
}

/** Point at a given fraction (0..1) along the great circle from a to b. */
export function intermediatePoint(a: LatLon, b: LatLon, fraction: number): LatLon {
  const φ1 = toRad(a.lat);
  const λ1 = toRad(a.lon);
  const φ2 = toRad(b.lat);
  const λ2 = toRad(b.lon);
  const δ = distanceNm(a, b) / EARTH_RADIUS_NM;
  if (δ === 0) return { lat: a.lat, lon: a.lon };
  const A = Math.sin((1 - fraction) * δ) / Math.sin(δ);
  const B = Math.sin(fraction * δ) / Math.sin(δ);
  const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
  const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
  const z = A * Math.sin(φ1) + B * Math.sin(φ2);
  return {
    lat: toDeg(Math.atan2(z, Math.hypot(x, y))),
    lon: norm180(toDeg(Math.atan2(y, x))),
  };
}

export const midpoint = (a: LatLon, b: LatLon) => intermediatePoint(a, b, 0.5);

/**
 * Leg course used in the nav log: the great-circle bearing at the leg's
 * midpoint. For VFR-length legs this matches the constant-heading (rhumb)
 * course to within a few tenths of a degree, which is what a pilot flies.
 */
export function legTrack(a: LatLon, b: LatLon): number {
  const m = midpoint(a, b);
  // Bearing at midpoint = bearing from midpoint towards b.
  return initialBearing(m, b);
}

/** Destination point given start, true bearing (deg) and distance (NM). */
export function destinationPoint(start: LatLon, bearingDeg: number, distNm: number): LatLon {
  const δ = distNm / EARTH_RADIUS_NM;
  const θ = toRad(bearingDeg);
  const φ1 = toRad(start.lat);
  const λ1 = toRad(start.lon);
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
  const λ2 =
    λ1 + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));
  return { lat: toDeg(φ2), lon: norm180(toDeg(λ2)) };
}

/**
 * Sample a great-circle leg into points no more than `maxStepNm` apart
 * (inclusive of both ends). Used for drawing and airspace intersection.
 */
export function densify(a: LatLon, b: LatLon, maxStepNm = 1): LatLon[] {
  const d = distanceNm(a, b);
  const steps = Math.max(1, Math.ceil(d / maxStepNm));
  const out: LatLon[] = [];
  for (let i = 0; i <= steps; i++) out.push(intermediatePoint(a, b, i / steps));
  return out;
}
