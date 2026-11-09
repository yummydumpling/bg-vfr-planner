import { describe, expect, it } from 'vitest';
import type { Waypoint } from '../domain/types';
import { computeNavLog } from '../nav/navlog';
import { formatTrack, summarizeLegs } from './legs';

const w = (id: string, lat: number, lon: number): Waypoint => ({ id, lat, lon, name: id, kind: 'user' });
const date = new Date(Date.UTC(2026, 10, 9));

describe('summarizeLegs', () => {
  const route = [w('LBSF', 42.6964, 23.418), w('LBPD', 42.0678, 24.8508), w('LBWN', 43.2321, 27.8251)];
  it('agrees with the nav log for track, variation and distance', () => {
    const s = summarizeLegs(route, date);
    const log = computeNavLog({
      points: route, date, wind: { fromDeg: 0, speedKt: 0 },
      perf: { tasKt: 100, fuelBurnPerHour: 20, taxiFuel: 0, reserveMinutes: 0 },
    });
    expect(s.legs).toHaveLength(2);
    s.legs.forEach((l, i) => {
      expect(l.distanceNm).toBeCloseTo(log.legs[i].distanceNm, 9);
      expect(l.magTrack).toBeCloseTo(log.legs[i].magTrack, 9);
    });
    expect(s.totalNm).toBeCloseTo(log.totals.distanceNm, 9);
  });
  it('handles empty and single-point routes', () => {
    expect(summarizeLegs([]).legs).toEqual([]);
    expect(summarizeLegs([route[0]]).totalNm).toBe(0);
  });
});

it('formatTrack', () => {
  expect(formatTrack(82.4)).toBe('082°');
  expect(formatTrack(359.6)).toBe('360°');
  expect(formatTrack(0.2)).toBe('360°');
  expect(formatTrack(5)).toBe('005°');
});
