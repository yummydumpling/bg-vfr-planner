import { describe, expect, it } from 'vitest';
import { pointInGeometry, pointInPolygon } from './geometry';

const square = [[[23, 42], [24, 42], [24, 43], [23, 43], [23, 42]]];
const withHole = [square[0], [[23.4, 42.4], [23.6, 42.4], [23.6, 42.6], [23.4, 42.6], [23.4, 42.4]]];

describe('point in polygon', () => {
  it('inside / outside', () => {
    expect(pointInPolygon({ lat: 42.5, lon: 23.5 }, square)).toBe(true);
    expect(pointInPolygon({ lat: 43.5, lon: 23.5 }, square)).toBe(false);
    expect(pointInPolygon({ lat: 42.5, lon: 22.9 }, square)).toBe(false);
  });
  it('respects holes', () => {
    expect(pointInPolygon({ lat: 42.5, lon: 23.5 }, withHole)).toBe(false);
    expect(pointInPolygon({ lat: 42.2, lon: 23.5 }, withHole)).toBe(true);
  });
  it('multipolygon', () => {
    const mp: GeoJSON.MultiPolygon = {
      type: 'MultiPolygon',
      coordinates: [square, [[[25, 42], [26, 42], [26, 43], [25, 42]]]],
    };
    expect(pointInGeometry({ lat: 42.2, lon: 25.8 }, mp)).toBe(true);
    expect(pointInGeometry({ lat: 42.5, lon: 24.5 }, mp)).toBe(false);
  });
});
