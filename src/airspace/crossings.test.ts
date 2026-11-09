import { describe, expect, it } from 'vitest';
import type { AirspaceProps, VerticalLimit } from '../domain/types';
import type { AirspaceCollection } from '../data/source';
import { EARTH_RADIUS_NM } from '../nav/geo';
import { assessVertical, crossingSeverity, routeCrossings } from './crossings';

const ft = (value: number, ref: 'GND' | 'MSL' = 'MSL'): VerticalLimit => ({ value, unit: 'FT', ref });
const fl = (value: number): VerticalLimit => ({ value, unit: 'FL', ref: 'STD' });
const GND = ft(0, 'GND');
const ONE_DEG = (Math.PI / 180) * EARTH_RADIUS_NM;

function airspace(id: string, ring: number[][], over: Partial<AirspaceProps> = {}): AirspaceCollection['features'][number] {
  return {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [ring] },
    properties: {
      id, name: id, type: 'CTR', cls: 'C', lower: GND, upper: ft(4500), country: 'BG',
      activity: 'NONE', byNotam: false, onRequest: false, onDemand: false, ...over,
    },
  };
}
const fc = (...f: AirspaceCollection['features']): AirspaceCollection => ({ type: 'FeatureCollection', features: f });
const square = (w: number, s: number, e: number, n: number) => [[w, s], [e, s], [e, n], [w, n], [w, s]];
const wp = (lat: number, lon: number) => ({ lat, lon });

describe('assessVertical', () => {
  it('inside / below / above with MSL and FL limits', () => {
    expect(assessVertical(3000, GND, ft(4500)).status).toBe('inside');
    expect(assessVertical(5000, GND, ft(4500)).status).toBe('above');
    expect(assessVertical(4500, ft(5500), fl(95)).status).toBe('below');
    expect(assessVertical(9000, ft(5500), fl(95)).status).toBe('inside');
    expect(assessVertical(9600, ft(5500), fl(95)).status).toBe('above');
  });
  it('marginal within 500 ft of a limit', () => {
    expect(assessVertical(4300, GND, ft(4500)).marginal).toBe(true);
    expect(assessVertical(3500, GND, ft(4500)).marginal).toBe(false);
    expect(assessVertical(5300, ft(5500), fl(95))).toMatchObject({ status: 'below', marginal: true });
    expect(assessVertical(200, GND, ft(4500)).marginal).toBe(false); // GND lower is not "marginal"
  });
  it('ground-referenced limits', () => {
    // 1000 ft AGL – FL95: depends on terrain unless clearly above upper
    expect(assessVertical(4500, ft(1000, 'GND'), fl(95))).toMatchObject({ status: 'check', aglLimit: true });
    expect(assessVertical(9900, ft(1000, 'GND'), fl(95)).status).toBe('above');
    // GND – 2000 ft AGL: below 2000 MSL means certainly below 2000 AGL
    expect(assessVertical(1500, GND, ft(2000, 'GND'))).toMatchObject({ status: 'inside', aglLimit: true });
    expect(assessVertical(3500, GND, ft(2000, 'GND')).status).toBe('check');
  });
});

describe('routeCrossings', () => {
  // Route along the equator from 0°E to 3°E; square spans 1°E–2°E.
  const route = [wp(0, 0), wp(0, 3)];

  it('finds entry and exit distances', () => {
    const [c] = routeCrossings(fc(airspace('A', square(1, -0.5, 2, 0.5))), route, 3000);
    expect(c.entryNm).toBeCloseTo(ONE_DEG, 1);
    expect(c.exitNm).toBeCloseTo(2 * ONE_DEG, 1);
    expect(c).toMatchObject({ entryLeg: 0, atDeparture: false, atDestination: false });
    expect(c.entryPoint.lon).toBeCloseTo(1, 3);
    expect(c.entryPoint.lat).toBeCloseTo(0, 6);
    expect(c.vertical.status).toBe('inside');
  });

  it('departure and destination inside', () => {
    const res = routeCrossings(fc(airspace('DEP', square(-0.2, -0.2, 0.2, 0.2)), airspace('DST', square(2.8, -0.2, 3.2, 0.2))), route, 3000);
    expect(res.map((c) => c.airspace.id)).toEqual(['DEP', 'DST']);
    expect(res[0]).toMatchObject({ entryNm: 0, atDeparture: true });
    expect(res[0].exitNm).toBeCloseTo(0.2 * ONE_DEG, 1);
    expect(res[1]).toMatchObject({ atDestination: true });
    expect(res[1].exitNm).toBeCloseTo(3 * ONE_DEG, 6);
  });

  it('re-entering the same airspace gives two crossings; multi-leg distances accumulate', () => {
    // U-shaped airspace crossed twice by a straight route
    const u = [[0.5, -1], [2.5, -1], [2.5, 1], [2, 1], [2, -0.5], [1, -0.5], [1, 1], [0.5, 1], [0.5, -1]];
    const res = routeCrossings(fc(airspace('U', u)), [wp(0, 0), wp(0, 1.5), wp(0, 3)], 3000);
    expect(res).toHaveLength(2);
    expect(res[0].entryNm).toBeCloseTo(0.5 * ONE_DEG, 1);
    expect(res[0].exitNm).toBeCloseTo(1 * ONE_DEG, 1);
    expect(res[1].entryNm).toBeCloseTo(2 * ONE_DEG, 1);
    expect(res[1].entryLeg).toBe(1);
  });

  it('ignores FIR/ACC, misses airspace off the route, keeps limits status', () => {
    const res = routeCrossings(fc(
      airspace('FIR', square(-1, -1, 4, 1), { type: 'FIR' }),
      airspace('NORTH', square(1, 0.5, 2, 1)),
      airspace('HIGH', square(1, -0.5, 2, 0.5), { type: 'TMA', lower: ft(5500), upper: fl(195) }),
    ), route, 3500);
    expect(res.map((c) => c.airspace.id)).toEqual(['HIGH']);
    expect(res[0].vertical.status).toBe('below');
  });

  it('small airspace narrower than the step is still found with the default step', () => {
    const tiny = square(1.5, -0.01, 1.506, 0.01); // ~0.36 NM wide
    expect(routeCrossings(fc(airspace('T', tiny)), route, 1000)).toHaveLength(1);
  });

  it('fewer than two points → nothing', () => {
    expect(routeCrossings(fc(airspace('A', square(1, -1, 2, 1))), [wp(0, 0)], 1000)).toEqual([]);
  });
});

describe('crossingSeverity', () => {
  const base = { entryNm: 0, exitNm: 1, entryLeg: 0, entryPoint: { lat: 0, lon: 0 }, atDeparture: false, atDestination: false };
  const props = (o: Partial<AirspaceProps>) => airspace('x', square(0, 0, 1, 1), o).properties;
  it('danger for restricted/danger areas when inside', () => {
    expect(crossingSeverity({ ...base, airspace: props({ type: 'D', cls: 'SUA' }), vertical: { status: 'inside', marginal: false, aglLimit: false } })).toBe('danger');
  });
  it('warn for controlled, none when clear vertically', () => {
    expect(crossingSeverity({ ...base, airspace: props({ type: 'TMA', cls: 'C' }), vertical: { status: 'inside', marginal: false, aglLimit: false } })).toBe('warn');
    expect(crossingSeverity({ ...base, airspace: props({ type: 'TMA', cls: 'C' }), vertical: { status: 'below', marginal: false, aglLimit: false } })).toBe('none');
    expect(crossingSeverity({ ...base, airspace: props({ type: 'TMA', cls: 'C' }), vertical: { status: 'below', marginal: true, aglLimit: false } })).toBe('warn');
  });
});
