import { describe, expect, it } from 'vitest';
import { formatDMS, formatDegMin, formatItem15Coord, parseCoordinate } from './coords';

describe('Item 15 coordinates', () => {
  it('formats DDMMNDDDMME', () => {
    expect(formatItem15Coord(42 + 41 / 60, 23 + 23 / 60)).toBe('4241N02323E');
    expect(formatItem15Coord(42.6952, 23.4062)).toBe('4242N02324E');
  });
  it('rounds to the nearest minute, carrying into degrees', () => {
    expect(formatItem15Coord(42 + 59.6 / 60, 27 + 59.5 / 60)).toBe('4300N02800E');
    expect(formatItem15Coord(42 + 0.4 / 60, 8 + 0.49 / 60)).toBe('4200N00800E');
  });
  it('southern and western hemispheres', () => {
    expect(formatItem15Coord(-33.5, -70.25)).toBe('3330S07015W');
  });
  it('rejects out of range', () => {
    expect(() => formatItem15Coord(91, 0)).toThrow();
  });
});

describe('display formats', () => {
  it('deg-min', () => {
    expect(formatDegMin(42.6952, 23.4062)).toBe("42°41.7'N 023°24.4'E");
  });
  it('DMS', () => {
    expect(formatDMS(42 + 34 / 60 + 13 / 3600, 27 + 30 / 60 + 55 / 3600)).toBe(`42°34'13"N 027°30'55"E`);
  });
});

describe('parseCoordinate', () => {
  const close = (r: { lat: number; lon: number } | null, lat: number, lon: number) => {
    expect(r).not.toBeNull();
    expect(r!.lat).toBeCloseTo(lat, 6);
    expect(r!.lon).toBeCloseTo(lon, 6);
  };
  it('ICAO compact', () => close(parseCoordinate('4241N02323E'), 42 + 41 / 60, 23 + 23 / 60));
  it('ICAO compact with seconds', () =>
    close(parseCoordinate('423413N0273055E'), 42 + 34 / 60 + 13 / 3600, 27 + 30 / 60 + 55 / 3600));
  it('decimal pair', () => close(parseCoordinate('42.6952, 23.4062'), 42.6952, 23.4062));
  it('DMS with symbols', () =>
    close(parseCoordinate(`42°34'13"N 27°30'55"E`), 42 + 34 / 60 + 13 / 3600, 27 + 30 / 60 + 55 / 3600));
  it('deg-min decimal', () => close(parseCoordinate(`42°41.2'N 23°23.5'E`), 42 + 41.2 / 60, 23 + 23.5 / 60));
  it('round-trips the Item 15 format', () => {
    const p = parseCoordinate(formatItem15Coord(43.2321, 27.8251))!;
    expect(formatItem15Coord(p.lat, p.lon)).toBe('4314N02750E');
  });
  it('rejects garbage and out-of-range', () => {
    expect(parseCoordinate('hello')).toBeNull();
    expect(parseCoordinate('95.0 23.0')).toBeNull();
    expect(parseCoordinate(`42°75'N 23°00'E`)).toBeNull();
  });
});
