import { describe, expect, it } from 'vitest';
import { airspaceBadge, airspaceCategory, formatLimit, formatVariation, limitToFeet, pairRunways } from './format';
import type { Runway } from './types';

describe('formatLimit', () => {
  it('chart notation', () => {
    expect(formatLimit({ value: 0, unit: 'FT', ref: 'GND' })).toBe('GND');
    expect(formatLimit({ value: 1000, unit: 'FT', ref: 'GND' })).toBe('1000 ft AGL');
    expect(formatLimit({ value: 8500, unit: 'FT', ref: 'MSL' })).toBe('8500 ft AMSL');
    expect(formatLimit({ value: 95, unit: 'FL', ref: 'STD' })).toBe('FL 95');
    expect(formatLimit({ value: 300, unit: 'M', ref: 'MSL' })).toBe('984 ft AMSL');
  });
  it('limitToFeet', () => {
    expect(limitToFeet({ value: 95, unit: 'FL', ref: 'STD' })).toEqual({ ft: 9500, agl: false });
    expect(limitToFeet({ value: 1000, unit: 'FT', ref: 'GND' })).toEqual({ ft: 1000, agl: true });
  });
});

describe('airspace categories', () => {
  it('groups types', () => {
    expect(airspaceCategory('CTR')).toBe('controlled');
    expect(airspaceCategory('D')).toBe('restricted');
    expect(airspaceCategory('ATZ')).toBe('atz');
    expect(airspaceCategory('FIR')).toBe('fir');
    expect(airspaceCategory('AWY')).toBe('other');
    expect(airspaceBadge('CTR', 'C')).toBe('CTR · C');
    expect(airspaceBadge('D', 'SUA')).toBe('D');
  });
});

const rw = (designator: string, trueHeading: number, extra: Partial<Runway> = {}): Runway => ({
  designator, trueHeading, surface: 'ASPHALT', paved: true, main: false, ...extra,
});

describe('pairRunways', () => {
  it('pairs reciprocal ends', () => {
    const p = pairRunways([rw('27', 274, { lengthM: 3600, widthM: 45 }), rw('09', 94)]);
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ designators: '09/27', lengthM: 3600, widthM: 45 });
  });
  it('pairs parallel runways L/R correctly', () => {
    const p = pairRunways([rw('09L', 90), rw('09R', 90), rw('27R', 270), rw('27L', 270)]);
    expect(p.map((x) => x.designators).sort()).toEqual(['09L/27R', '09R/27L']);
  });
  it('keeps a single-direction runway alone', () => {
    expect(pairRunways([rw('16', 160)])).toMatchObject([{ designators: '16' }]);
  });
  it('separate crossing runways', () => {
    expect(pairRunways([rw('03', 30), rw('21', 210), rw('12', 120), rw('30', 300)]).map((x) => x.designators))
      .toEqual(['03/21', '12/30']);
  });
});

it('formatVariation', () => {
  expect(formatVariation(5.83)).toBe('5.8° E');
  expect(formatVariation(-2)).toBe('2.0° W');
});
