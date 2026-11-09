import { describe, expect, it } from 'vitest';
import { EARTH_RADIUS_NM } from './geo';
import { computeNavLog, formatDuration } from './navlog';

const perf = { tasKt: 100, fuelBurnPerHour: 30, taxiFuel: 3, reserveMinutes: 30, usableFuel: 100 };
const date = new Date(Date.UTC(2026, 10, 9));
const oneDeg = (Math.PI / 180) * EARTH_RADIUS_NM;

describe('computeNavLog', () => {
  it('single northbound leg, calm', () => {
    const log = computeNavLog({
      points: [{ name: 'A', lat: 42, lon: 25 }, { name: 'B', lat: 43, lon: 25 }],
      perf, wind: { fromDeg: 0, speedKt: 0 }, date,
    });
    const leg = log.legs[0];
    expect(leg.distanceNm).toBeCloseTo(oneDeg, 6);
    expect(leg.trueTrack).toBeCloseTo(0, 6);
    expect(leg.variation).toBeGreaterThan(4);
    expect(leg.magTrack).toBeCloseTo(360 - leg.variation, 6);
    expect(leg.groundSpeed).toBeCloseTo(100, 9);
    expect(leg.eteMin).toBeCloseTo(oneDeg * 0.6, 6);
    expect(leg.fuel).toBeCloseTo(oneDeg * 0.3, 6);
    expect(log.totals.reserveFuel).toBe(15);
    expect(log.totals.requiredFuel).toBeCloseTo(3 + oneDeg * 0.3 + 15, 6);
    expect(log.totals.extraFuel).toBeCloseTo(100 - (3 + oneDeg * 0.3 + 15), 6);
    expect(log.totals.enduranceMin).toBeCloseTo((97 / 30) * 60, 6);
  });

  it('headwind slows the leg and accumulates', () => {
    const log = computeNavLog({
      points: [
        { name: 'A', lat: 42, lon: 25 },
        { name: 'B', lat: 43, lon: 25 },
        { name: 'C', lat: 42, lon: 25 },
      ],
      perf, wind: { fromDeg: 360, speedKt: 20 }, date,
    });
    const [l1, l2] = log.legs;
    expect(l1.groundSpeed).toBeCloseTo(80, 6);
    expect(l2.groundSpeed).toBeCloseTo(120, 6);
    expect(l2.cumDistanceNm).toBeCloseTo(2 * oneDeg, 6);
    expect(l2.cumMin).toBeCloseTo(l1.eteMin! + l2.eteMin!, 9);
    expect(log.totals.timeMin).toBeCloseTo(l2.cumMin!, 9);
  });

  it('per-leg wind overrides route wind', () => {
    const log = computeNavLog({
      points: [{ name: 'A', lat: 42, lon: 25 }, { name: 'B', lat: 43, lon: 25 }],
      perf, wind: { fromDeg: 0, speedKt: 0 }, legWinds: [{ fromDeg: 180, speedKt: 10 }], date,
    });
    expect(log.legs[0].groundSpeed).toBeCloseTo(110, 6);
  });

  it('unflyable leg propagates nulls to totals', () => {
    const log = computeNavLog({
      points: [{ name: 'A', lat: 42, lon: 25 }, { name: 'B', lat: 43, lon: 25 }],
      perf, wind: { fromDeg: 0, speedKt: 150 }, date,
    });
    expect(log.legs[0].groundSpeed).toBeNull();
    expect(log.totals.timeMin).toBeNull();
    expect(log.totals.requiredFuel).toBeNull();
  });

  it('empty and single-point routes', () => {
    expect(computeNavLog({ points: [], perf, wind: { fromDeg: 0, speedKt: 0 } }).legs).toEqual([]);
    const one = computeNavLog({ points: [{ name: 'A', lat: 42, lon: 25 }], perf, wind: { fromDeg: 0, speedKt: 0 } });
    expect(one.totals.distanceNm).toBe(0);
    expect(one.totals.timeMin).toBe(0);
  });
});

describe('formatDuration', () => {
  it('formats H:MM', () => {
    expect(formatDuration(75.4)).toBe('1:15');
    expect(formatDuration(59.6)).toBe('1:00');
    expect(formatDuration(null)).toBe('--:--');
  });
});
