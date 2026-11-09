import { norm360, toDeg, toRad } from './geo';

export interface Wind {
  /** Direction the wind blows FROM, degrees true. */
  fromDeg: number;
  /** Wind speed, knots. */
  speedKt: number;
}

export interface WindTriangleResult {
  /** Wind correction angle, degrees (+ = heading right of track). */
  wcaDeg: number;
  /** True heading to fly, degrees [0,360). */
  trueHeadingDeg: number;
  /** Ground speed, knots. */
  groundSpeedKt: number;
  /** Head(+)/tail(−) wind component along track, knots. */
  headwindKt: number;
  /** Crosswind component, knots (+ = from the right). */
  crosswindKt: number;
}

/**
 * Solve the wind triangle for a desired true track.
 * Returns null when the track cannot be flown (crosswind ≥ TAS or GS ≤ 0).
 */
export function windTriangle(
  trueTrackDeg: number,
  tasKt: number,
  wind: Wind,
): WindTriangleResult | null {
  if (tasKt <= 0) return null;
  const rel = toRad(wind.fromDeg - trueTrackDeg);
  const crosswind = wind.speedKt * Math.sin(rel);
  const headwind = wind.speedKt * Math.cos(rel);
  const s = crosswind / tasKt;
  if (Math.abs(s) >= 1) return null;
  const wca = Math.asin(s);
  const gs = tasKt * Math.cos(wca) - headwind;
  if (gs <= 0) return null;
  const wcaDeg = toDeg(wca);
  return {
    wcaDeg,
    trueHeadingDeg: norm360(trueTrackDeg + wcaDeg),
    groundSpeedKt: gs,
    headwindKt: headwind,
    crosswindKt: crosswind,
  };
}

/** True → magnetic. Variation East positive ("East is least"). */
export const trueToMagnetic = (trueDeg: number, variationDeg: number) =>
  norm360(trueDeg - variationDeg);

/** Magnetic → true. */
export const magneticToTrue = (magDeg: number, variationDeg: number) =>
  norm360(magDeg + variationDeg);
