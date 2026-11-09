/**
 * In-flight navigation: leg sequencing and values to the next waypoint.
 * Pure functions — the UI feeds them GPS fixes.
 */
import type { Waypoint } from '../domain/types';
import { alongTrackNm, crossTrackNm, distanceNm, initialBearing, intermediatePoint, legTrack, type LatLon } from '../nav/geo';
import { magneticVariation } from '../nav/magvar/wmm';
import { trueToMagnetic } from '../nav/wind';

export interface Fix {
  lat: number;
  lon: number;
  /** GNSS altitude in metres (as reported; not a substitute for the altimeter). */
  altM: number | null;
  /** Horizontal accuracy, metres (95 %-ish as reported by the device). */
  accuracyM: number;
  /** Ground speed, knots (null when unknown). */
  speedKt: number | null;
  /** Track over ground, degrees true (null when unknown or stationary). */
  trackTrue: number | null;
  /** Fix time, ms since epoch. */
  time: number;
}

/** Waypoint is considered reached within this distance. */
export const SEQUENCE_RADIUS_NM = 0.5;
/** Below this ground speed ETE/ETA are not meaningful. */
export const MIN_SPEED_KT = 20;
/** Derived speeds above this are treated as GPS glitches. */
export const MAX_PLAUSIBLE_KT = 400;
const MS_TO_KT = 3600 / 1852;

/** Fill in speed/track from the previous fix when the device doesn't report them. */
export function withMotion(prev: Fix | null, cur: Fix): Fix {
  if (cur.speedKt != null && cur.trackTrue != null) return cur;
  if (!prev) return cur;
  const dt = (cur.time - prev.time) / 1000;
  if (dt < 0.8 || dt > 30) return cur;
  const d = distanceNm(prev, cur);
  const derived = (d / dt) * 3600;
  // A position jump (GPS glitch) gives an impossible speed — don't show it.
  if (cur.speedKt == null && derived > MAX_PLAUSIBLE_KT) return cur;
  const speedKt = cur.speedKt ?? derived;
  // Track from positions only when we actually move (avoids noise when parked)
  const trackTrue = cur.trackTrue ?? (speedKt >= 5 && d * 1852 > 5 ? initialBearing(prev, cur) : null);
  return { ...cur, speedKt, trackTrue };
}

export const msToKt = (ms: number) => ms * MS_TO_KT;

/** Leg index (0-based) whose segment is closest to the position. */
export function closestLeg(wps: LatLon[], pos: LatLon): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < wps.length - 1; i++) {
    const a = wps[i];
    const b = wps[i + 1];
    const len = distanceNm(a, b);
    const atd = alongTrackNm(a, b, pos);
    const d = atd < 0 ? distanceNm(a, pos) : atd > len ? distanceNm(b, pos) : Math.abs(crossTrackNm(a, b, pos));
    // ties (e.g. at a shared waypoint) prefer the later leg
    if (d <= bestD + 1e-6) { best = i; bestD = d; }
  }
  return best;
}

/**
 * Advance the active leg when the "to" waypoint is reached or passed abeam.
 * With `abeam: false` (after the pilot picked a leg manually) only reaching
 * the waypoint advances.
 */
export function sequenceLeg(wps: LatLon[], activeLeg: number, pos: LatLon, opts: { abeam?: boolean } = {}): number {
  const abeam = opts.abeam ?? true;
  let leg = Math.max(0, Math.min(activeLeg, wps.length - 2));
  while (leg < wps.length - 2) {
    const from = wps[leg];
    const to = wps[leg + 1];
    if (distanceNm(pos, to) <= SEQUENCE_RADIUS_NM || (abeam && alongTrackNm(from, to, pos) >= distanceNm(from, to))) leg++;
    else break;
  }
  return leg;
}

export interface NavState {
  activeLeg: number;
  from: Waypoint;
  to: Waypoint;
  distToNm: number;
  /** Direct bearing to the next waypoint, °M. */
  brgMag: number;
  /** Desired track of the active leg, °M. */
  dtkMag: number;
  /** Cross-track error, NM (+ = right of course). */
  xteNm: number;
  /** Track over ground, °M (null when not moving). */
  trkMag: number | null;
  eteMin: number | null;
  etaTo: Date | null;
  distDestNm: number;
  eteDestMin: number | null;
  etaDest: Date | null;
  /** Last waypoint reached. */
  arrived: boolean;
}

export function navState(wps: Waypoint[], activeLeg: number, fix: Fix, now = new Date(fix.time)): NavState | null {
  if (wps.length < 2) return null;
  const leg = Math.max(0, Math.min(activeLeg, wps.length - 2));
  const from = wps[leg];
  const to = wps[leg + 1];
  const varDeg = magneticVariation(fix.lat, fix.lon, now);
  const distToNm = distanceNm(fix, to);
  let rest = 0;
  for (let i = leg + 1; i < wps.length - 1; i++) rest += distanceNm(wps[i], wps[i + 1]);
  const distDestNm = distToNm + rest;
  const gs = fix.speedKt != null && fix.speedKt >= MIN_SPEED_KT ? fix.speedKt : null;
  const eteMin = gs ? (distToNm / gs) * 60 : null;
  const eteDestMin = gs ? (distDestNm / gs) * 60 : null;
  return {
    activeLeg: leg,
    from,
    to,
    distToNm,
    brgMag: trueToMagnetic(initialBearing(fix, to), varDeg),
    dtkMag: trueToMagnetic(legTrack(from, to), varDeg),
    xteNm: crossTrackNm(from, to, fix),
    trkMag: fix.trackTrue == null ? null : trueToMagnetic(fix.trackTrue, varDeg),
    eteMin,
    etaTo: eteMin == null ? null : new Date(now.getTime() + eteMin * 60000),
    distDestNm,
    eteDestMin,
    etaDest: eteDestMin == null ? null : new Date(now.getTime() + eteDestMin * 60000),
    arrived: leg === wps.length - 2 && distToNm <= SEQUENCE_RADIUS_NM,
  };
}

/** Position after flying `distNm` along the route (for the simulator). */
export function pointAlongRoute(wps: LatLon[], distNm: number): { pos: LatLon; trackTrue: number; done: boolean } {
  let remaining = Math.max(0, distNm);
  for (let i = 0; i < wps.length - 1; i++) {
    const a = wps[i];
    const b = wps[i + 1];
    const len = distanceNm(a, b);
    if (remaining <= len || i === wps.length - 2) {
      const f = len === 0 ? 1 : Math.min(1, remaining / len);
      const pos = intermediatePoint(a, b, f);
      const ahead = intermediatePoint(a, b, Math.min(1, f + 0.001));
      const trackTrue = f >= 0.999 ? initialBearing(a, b) : initialBearing(pos, ahead);
      return { pos, trackTrue, done: remaining >= len && i === wps.length - 2 };
    }
    remaining -= len;
  }
  return { pos: wps[0], trackTrue: 0, done: true };
}
