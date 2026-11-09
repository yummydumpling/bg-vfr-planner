import { describe, expect, it } from 'vitest';
import { magneticField, magneticVariation, toDecimalYear } from './wmm';
import { WMM2025_TEST_VALUES } from './wmm2025.testvalues';

describe('WMM2025 against NOAA test values', () => {
  it.each(WMM2025_TEST_VALUES.map((r) => [...r]))(
    '%s yr, %s km, %s°, %s°',
    (year, altKm, lat, lon, x, y, z, decl) => {
      const f = magneticField(lat, lon, altKm, year);
      expect(Math.abs(f.x - x)).toBeLessThan(0.5);
      expect(Math.abs(f.y - y)).toBeLessThan(0.5);
      expect(Math.abs(f.z - z)).toBeLessThan(0.5);
      expect(Math.abs(f.declination - decl)).toBeLessThan(0.006);
      expect(f.outsideValidity).toBe(false);
    },
  );
});

describe('magnetic variation in Bulgaria', () => {
  it('is a few degrees East (sanity)', () => {
    const d = new Date(Date.UTC(2026, 10, 9));
    for (const [lat, lon] of [[42.69, 23.41], [43.23, 27.83], [42.07, 24.85]]) {
      const v = magneticVariation(lat, lon, d);
      expect(v).toBeGreaterThan(4);
      expect(v).toBeLessThan(8);
    }
  });
  it('flags dates outside the model', () => {
    expect(magneticField(42, 25, 0, 2031).outsideValidity).toBe(true);
  });
});

describe('toDecimalYear', () => {
  it('start and middle of year', () => {
    expect(toDecimalYear(new Date(Date.UTC(2026, 0, 1)))).toBe(2026);
    expect(toDecimalYear(new Date(Date.UTC(2026, 6, 2, 12)))).toBeCloseTo(2026.5, 3);
  });
});
