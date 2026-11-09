import { describe, expect, it } from 'vitest';
import { magneticToTrue, trueToMagnetic, windTriangle } from './wind';

describe('wind triangle', () => {
  it('calm wind: heading = track, GS = TAS', () => {
    const r = windTriangle(123, 100, { fromDeg: 0, speedKt: 0 })!;
    expect(r.wcaDeg).toBeCloseTo(0, 9);
    expect(r.trueHeadingDeg).toBeCloseTo(123, 9);
    expect(r.groundSpeedKt).toBeCloseTo(100, 9);
  });
  it('pure headwind and tailwind', () => {
    expect(windTriangle(90, 100, { fromDeg: 90, speedKt: 20 })!.groundSpeedKt).toBeCloseTo(80, 9);
    expect(windTriangle(90, 100, { fromDeg: 270, speedKt: 20 })!.groundSpeedKt).toBeCloseTo(120, 9);
  });
  it('crosswind from the left: crab left', () => {
    // Track 090, TAS 100, wind 360/20
    const r = windTriangle(90, 100, { fromDeg: 360, speedKt: 20 })!;
    expect(r.wcaDeg).toBeCloseTo(-11.537, 3);
    expect(r.trueHeadingDeg).toBeCloseTo(78.463, 3);
    expect(r.groundSpeedKt).toBeCloseTo(97.980, 3);
    expect(r.crosswindKt).toBeCloseTo(-20, 9);
  });
  it('crosswind from the right: crab right, heading wraps past 360', () => {
    const r = windTriangle(355, 90, { fromDeg: 85, speedKt: 15 })!;
    expect(r.wcaDeg).toBeGreaterThan(0);
    expect(r.trueHeadingDeg).toBeCloseTo((355 + r.wcaDeg) % 360, 9);
    expect(r.trueHeadingDeg).toBeLessThan(15);
  });
  it('quartering headwind worked example', () => {
    // TC 045, TAS 110, W/V 090/25 → wind 45° right of nose
    const r = windTriangle(45, 110, { fromDeg: 90, speedKt: 25 })!;
    const xw = 25 * Math.sin(Math.PI / 4);
    const wca = Math.asin(xw / 110);
    expect(r.wcaDeg).toBeCloseTo((wca * 180) / Math.PI, 9);
    expect(r.groundSpeedKt).toBeCloseTo(110 * Math.cos(wca) - xw, 9);
  });
  it('unflyable cases return null', () => {
    expect(windTriangle(90, 100, { fromDeg: 0, speedKt: 120 })).toBeNull();
    expect(windTriangle(90, 50, { fromDeg: 90, speedKt: 60 })).toBeNull();
    expect(windTriangle(90, 0, { fromDeg: 0, speedKt: 0 })).toBeNull();
  });
});

describe('true / magnetic', () => {
  it('East variation is subtracted (East is least)', () => {
    expect(trueToMagnetic(100, 5)).toBe(95);
    expect(trueToMagnetic(2, 5)).toBe(357);
    expect(trueToMagnetic(100, -3)).toBe(103);
    expect(magneticToTrue(357, 5)).toBe(2);
  });
});
