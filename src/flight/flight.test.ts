import { describe, expect, it } from 'vitest';
import type { Route } from '../domain/types';
import { defaultAircraft, validateAircraft } from './aircraft';
import { buildNavLog, formatFuel, formatVarShort, formatWca } from './plan';

describe('aircraft validation', () => {
  it('default profile is valid', () => {
    expect(validateAircraft(defaultAircraft())).toEqual({});
  });
  it('flags bad values', () => {
    const a = { ...defaultAircraft(), name: ' ', tasKt: 10, fuelBurnPerHour: 0, taxiFuel: 500, reserveMinutes: -5, icaoType: 'cessna' };
    expect(Object.keys(validateAircraft(a)).sort()).toEqual(['fuelBurnPerHour', 'icaoType', 'name', 'reserveMinutes', 'tasKt', 'taxiFuel']);
  });
  it('NaN is invalid', () => {
    expect(validateAircraft({ ...defaultAircraft(), tasKt: Number.NaN }).tasKt).toBe('errTas');
  });
});

describe('buildNavLog', () => {
  const route: Route = {
    id: 'r', name: '', updatedAt: '', cruiseAltFt: 3500,
    wind: { fromDeg: 360, speedKt: 20 },
    waypoints: [
      { id: 'a', lat: 42, lon: 25, name: 'A', kind: 'user' },
      { id: 'b', lat: 43, lon: 25, name: 'B', kind: 'user' },
    ],
  };
  it('uses aircraft performance and route wind', () => {
    const ac = { ...defaultAircraft(), tasKt: 100, fuelBurnPerHour: 30, taxiFuel: 3, reserveMinutes: 30, usableFuel: 100 };
    const log = buildNavLog(route, ac, new Date(Date.UTC(2026, 10, 9)));
    expect(log.legs[0].groundSpeed).toBeCloseTo(80, 6); // straight headwind
    expect(log.totals.reserveFuel).toBe(15);
    expect(log.totals.taxiFuel).toBe(3);
    expect(log.totals.extraFuel).toBeLessThan(100);
  });
});

describe('formatting', () => {
  it('formatWca', () => {
    expect(formatWca(4.6)).toBe('+5°');
    expect(formatWca(-3.2)).toBe('−3°');
    expect(formatWca(0.3)).toBe('0°');
    expect(formatWca(null)).toBe('—');
  });
  it('formatVarShort / formatFuel', () => {
    expect(formatVarShort(5.83)).toBe('5.8E');
    expect(formatVarShort(-1.2)).toBe('1.2W');
    expect(formatFuel(12.345, 'L')).toBe('12.3 L');
    expect(formatFuel(null, 'L')).toBe('—');
  });
});
