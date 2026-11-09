import type { Waypoint } from '../domain/types';
import { distanceNm, legTrack, midpoint } from '../nav/geo';
import { magneticVariation } from '../nav/magvar/wmm';
import { trueToMagnetic } from '../nav/wind';

export interface LegSummary {
  from: Waypoint;
  to: Waypoint;
  trueTrack: number;
  magTrack: number;
  distanceNm: number;
  mid: { lat: number; lon: number };
}

/** Track & distance per leg (no wind/performance — that's the nav log). */
export function summarizeLegs(wps: Waypoint[], date = new Date()): { legs: LegSummary[]; totalNm: number } {
  const legs: LegSummary[] = [];
  let totalNm = 0;
  for (let i = 0; i < wps.length - 1; i++) {
    const from = wps[i];
    const to = wps[i + 1];
    const mid = midpoint(from, to);
    const tt = legTrack(from, to);
    const d = distanceNm(from, to);
    totalNm += d;
    legs.push({ from, to, trueTrack: tt, magTrack: trueToMagnetic(tt, magneticVariation(mid.lat, mid.lon, date)), distanceNm: d, mid });
  }
  return { legs, totalNm };
}

/** "082°" with leading zeros; 0 shown as 360 as on charts. */
export function formatTrack(deg: number): string {
  const r = Math.round(deg) % 360;
  return `${String(r === 0 ? 360 : r).padStart(3, '0')}°`;
}
