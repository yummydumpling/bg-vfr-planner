import { describe, expect, it } from 'vitest';
import {
  EARTH_RADIUS_NM, densify, destinationPoint, distanceNm, initialBearing,
  intermediatePoint, legTrack, norm180, norm360,
} from './geo';

describe('angle normalisation', () => {
  it('norm360', () => {
    expect(norm360(370)).toBe(10);
    expect(norm360(-10)).toBe(350);
    expect(norm360(360)).toBe(0);
    expect(Object.is(norm360(-0), 0)).toBe(true);
  });
  it('norm180', () => {
    expect(norm180(190)).toBe(-170);
    expect(norm180(-190)).toBe(170);
    expect(norm180(180)).toBe(180);
  });
});

describe('great circle', () => {
  const oneDegNm = (Math.PI / 180) * EARTH_RADIUS_NM; // ≈ 60.04 NM

  it('1° of latitude ≈ 60 NM, bearing 000', () => {
    const a = { lat: 42, lon: 25 };
    const b = { lat: 43, lon: 25 };
    expect(distanceNm(a, b)).toBeCloseTo(oneDegNm, 6);
    expect(initialBearing(a, b)).toBeCloseTo(0, 9);
    expect(initialBearing(b, a)).toBeCloseTo(180, 9);
  });

  it('along the equator', () => {
    expect(distanceNm({ lat: 0, lon: 0 }, { lat: 0, lon: 1 })).toBeCloseTo(oneDegNm, 6);
    expect(initialBearing({ lat: 0, lon: 0 }, { lat: 0, lon: 1 })).toBeCloseTo(90, 9);
    expect(initialBearing({ lat: 0, lon: 0 }, { lat: 0, lon: -1 })).toBeCloseTo(270, 9);
  });

  it('LAX → JFK reference example (0.623585 rad, initial course ≈ 066°)', () => {
    const lax = { lat: 33 + 57 / 60, lon: -(118 + 24 / 60) };
    const jfk = { lat: 40 + 38 / 60, lon: -(73 + 47 / 60) };
    expect(distanceNm(lax, jfk) / EARTH_RADIUS_NM).toBeCloseTo(0.623585, 5);
    expect(initialBearing(lax, jfk)).toBeCloseTo(65.89, 1);
  });

  it('LBSF → LBWN is ≈ 196 NM on an easterly track', () => {
    const lbsf = { lat: 42.6952, lon: 23.4062 };
    const lbwn = { lat: 43.2321, lon: 27.8251 };
    const d = distanceNm(lbsf, lbwn);
    expect(d).toBeGreaterThan(194);
    expect(d).toBeLessThan(199);
    // Track at midpoint is the course flown; slightly north of east
    expect(legTrack(lbsf, lbwn)).toBeGreaterThan(78);
    expect(legTrack(lbsf, lbwn)).toBeLessThan(82);
  });

  it('destinationPoint is the inverse of distance/bearing', () => {
    const a = { lat: 42.15, lon: 24.75 };
    const b = destinationPoint(a, 123.4, 57.8);
    expect(distanceNm(a, b)).toBeCloseTo(57.8, 6);
    expect(initialBearing(a, b)).toBeCloseTo(123.4, 6);
  });

  it('intermediatePoint endpoints and halfway', () => {
    const a = { lat: 42, lon: 23 };
    const b = { lat: 43.5, lon: 27.9 };
    expect(intermediatePoint(a, b, 0).lat).toBeCloseTo(42, 9);
    expect(intermediatePoint(a, b, 1).lon).toBeCloseTo(27.9, 9);
    const m = intermediatePoint(a, b, 0.5);
    expect(distanceNm(a, m)).toBeCloseTo(distanceNm(m, b), 6);
    expect(intermediatePoint(a, a, 0.5)).toEqual(a);
  });

  it('densify keeps steps under the limit', () => {
    const pts = densify({ lat: 42, lon: 23 }, { lat: 42, lon: 24 }, 5);
    // 44.6 NM / 5 NM → 9 steps → 10 points
    expect(pts.length).toBe(10);
    for (let i = 1; i < pts.length; i++) expect(distanceNm(pts[i - 1], pts[i])).toBeLessThanOrEqual(5);
  });
});

describe('cross-track / along-track', () => {
  const a = { lat: 0, lon: 0 };
  const b = { lat: 0, lon: 2 };
  const oneDeg = (Math.PI / 180) * EARTH_RADIUS_NM;
  it('right of an eastbound course is south', async () => {
    const { crossTrackNm, alongTrackNm } = await import('./geo');
    expect(crossTrackNm(a, b, { lat: -0.1, lon: 1 })).toBeCloseTo(0.1 * oneDeg, 3);
    expect(crossTrackNm(a, b, { lat: 0.1, lon: 1 })).toBeCloseTo(-0.1 * oneDeg, 3);
    expect(crossTrackNm(a, b, { lat: 0, lon: 1.5 })).toBeCloseTo(0, 9);
    expect(alongTrackNm(a, b, { lat: 0.1, lon: 1 })).toBeCloseTo(oneDeg, 2);
    expect(alongTrackNm(a, b, { lat: 0, lon: -0.5 })).toBeCloseTo(-0.5 * oneDeg, 3);
    expect(alongTrackNm(a, b, { lat: 0, lon: 2.5 })).toBeCloseTo(2.5 * oneDeg, 3);
  });
});
