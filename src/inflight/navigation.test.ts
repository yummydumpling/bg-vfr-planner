import { describe, expect, it } from 'vitest';
import type { Waypoint } from '../domain/types';
import { EARTH_RADIUS_NM } from '../nav/geo';
import { closestLeg, navState, pointAlongRoute, sequenceLeg, withMotion, type Fix } from './navigation';

const W = (id: string, lat: number, lon: number): Waypoint => ({ id, name: id, lat, lon, kind: 'user' });
// Eastbound along the equator: A(0,0) → B(0,1) → C(0,2) → D(1,2) (north)
const wps = [W('A', 0, 0), W('B', 0, 1), W('C', 0, 2), W('D', 1, 2)];
const ONE = (Math.PI / 180) * EARTH_RADIUS_NM;
const fix = (lat: number, lon: number, o: Partial<Fix> = {}): Fix => ({ lat, lon, altM: 1000, accuracyM: 5, speedKt: 100, trackTrue: 90, time: Date.UTC(2026, 10, 10, 10), ...o });

describe('leg sequencing', () => {
  it('stays on the leg until the waypoint is reached or passed abeam', () => {
    expect(sequenceLeg(wps, 0, { lat: 0, lon: 0.5 })).toBe(0);
    expect(sequenceLeg(wps, 0, { lat: 0.001, lon: 0.995 })).toBe(1); // within 0.5 NM of B
    expect(sequenceLeg(wps, 0, { lat: 0.05, lon: 1.02 })).toBe(1);   // passed abeam B, 3 NM off
    expect(sequenceLeg(wps, 0, { lat: 0.1, lon: 2.01 })).toBe(2);    // skips several
    expect(sequenceLeg(wps, 2, { lat: 2, lon: 2 })).toBe(2);         // never beyond the last leg
    expect(sequenceLeg(wps, 0, { lat: 0.05, lon: 1.02 }, { abeam: false })).toBe(0); // manual leg: only on reaching
  });
  it('closest leg when starting mid-route', () => {
    expect(closestLeg(wps, { lat: 0.05, lon: 1.5 })).toBe(1);
    expect(closestLeg(wps, { lat: 0.6, lon: 2.05 })).toBe(2);
    expect(closestLeg(wps, { lat: -0.2, lon: -0.2 })).toBe(0);
  });
});

describe('navState', () => {
  it('distance, bearing, cross-track and times to the next waypoint', () => {
    const s = navState(wps, 0, fix(-0.01, 0.5))!; // 0.6 NM right (south) of course, halfway to B
    expect(s.to.name).toBe('B');
    expect(s.distToNm).toBeCloseTo(0.5 * ONE, 0);
    expect(s.xteNm).toBeCloseTo(0.01 * ONE, 2);
    expect(s.brgMag).toBeGreaterThan(80); // ~091°T minus small variation at 0/0
    expect(s.eteMin).toBeCloseTo((s.distToNm / 100) * 60, 6);
    expect(s.distDestNm).toBeCloseTo(s.distToNm + 2 * ONE, 0);
    expect(s.etaDest!.getTime() - Date.UTC(2026, 10, 10, 10)).toBeCloseTo((s.distDestNm / 100) * 3600000, -3);
    expect(s.arrived).toBe(false);
  });
  it('no ETE/ETA when (nearly) stationary; arrived at the last waypoint', () => {
    expect(navState(wps, 0, fix(0, 0.5, { speedKt: 3 }))!.eteMin).toBeNull();
    expect(navState(wps, 2, fix(0.999, 2))!.arrived).toBe(true);
    expect(navState([wps[0]], 0, fix(0, 0))).toBeNull();
  });
});

describe('withMotion', () => {
  it('derives speed and track from consecutive fixes', () => {
    const a = fix(0, 0, { speedKt: null, trackTrue: null, time: 0 });
    const b = fix(0, 0.5 / 60, { speedKt: null, trackTrue: null, time: 18_000 }); // ~0.5 NM east in 18 s
    const m = withMotion(a, b);
    expect(m.speedKt).toBeCloseTo(100, 0);
    expect(m.trackTrue).toBeCloseTo(90, 3);
    expect(withMotion(null, b)).toBe(b);
    // GPS jump: 30 NM in 2 s is a glitch, not a speed
    const jump = fix(0, 0.5, { speedKt: null, trackTrue: null, time: 2000 });
    expect(withMotion(a, jump).speedKt).toBeNull();
    // parked: no track from GPS jitter
    expect(withMotion(a, fix(0.00001, 0, { speedKt: null, trackTrue: null, time: 2000 })).trackTrue).toBeNull();
  });
});

describe('simulator path', () => {
  it('moves along the legs', () => {
    expect(pointAlongRoute(wps, 0.5 * ONE).pos.lon).toBeCloseTo(0.5, 6);
    const p = pointAlongRoute(wps, 2.5 * ONE);
    expect(p.pos.lat).toBeCloseTo(0.5, 3);
    expect(p.trackTrue).toBeCloseTo(0, 3);
    expect(pointAlongRoute(wps, 10 * ONE).done).toBe(true);
  });
});
