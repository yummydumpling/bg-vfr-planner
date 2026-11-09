import { describe, expect, it } from 'vitest';
import {
  normalizeAirport, normalizeAirspace, normalizeLimit, normalizeNavaid, normalizeReportingPoint,
  type OaAirport, type OaAirspace,
} from './normalize';

const ring = [[23, 42], [23.123456789, 42], [23.1, 42.1], [23, 42]];

describe('openAIP airspace', () => {
  const raw: OaAirspace = {
    _id: 'x1', name: ' CTR LBSF ', type: 4, icaoClass: 2, country: 'BG',
    geometry: { type: 'Polygon', coordinates: [ring] },
    lowerLimit: { value: 0, unit: 1, referenceDatum: 0 },
    upperLimit: { value: 8500, unit: 1, referenceDatum: 1 },
  };
  it('maps type, class and limits', () => {
    const f = normalizeAirspace(raw);
    expect(f.properties).toMatchObject({
      id: 'x1', name: 'CTR LBSF', type: 'CTR', cls: 'C',
      lower: { value: 0, unit: 'FT', ref: 'GND' },
      upper: { value: 8500, unit: 'FT', ref: 'MSL' },
      activity: 'NONE', byNotam: false,
    });
    expect(f.id).toBe('x1');
  });
  it('rounds coordinates to 5 dp', () => {
    expect(normalizeAirspace(raw).geometry.coordinates[0][1]).toEqual([23.12346, 42]);
  });
  it('maps danger/restricted/prohibited/TMA and SUA class', () => {
    const t = (type: number, icaoClass = 8) => normalizeAirspace({ ...raw, type, icaoClass }).properties;
    expect(t(1).type).toBe('R');
    expect(t(2).type).toBe('D');
    expect(t(3).type).toBe('P');
    expect(t(7, 2).type).toBe('TMA');
    expect(t(13, 6)).toMatchObject({ type: 'ATZ', cls: 'G' });
    expect(t(2).cls).toBe('SUA');
    expect(t(99).type).toBe('OTHER');
  });
  it('flight levels', () => {
    expect(normalizeLimit({ value: 95, unit: 6, referenceDatum: 2 })).toEqual({ value: 95, unit: 'FL', ref: 'STD' });
  });
});

describe('openAIP airport', () => {
  const raw: OaAirport = {
    _id: 'a1', name: 'SOFIA', icaoCode: 'LBSF', iataCode: 'SOF', type: 3, trafficType: [0, 1],
    magneticDeclination: 6, country: 'BG',
    geometry: { type: 'Point', coordinates: [23.418055555556, 42.696388888889] },
    elevation: { value: 531, unit: 0, referenceDatum: 1 },
    frequencies: [{ value: '118.255', unit: 2, type: 14, name: 'SOFIA TOWER', primary: true }],
    runways: [{
      designator: '09', trueHeading: 94, mainRunway: true, surface: { mainComposite: 0 },
      dimension: { length: { value: 3600, unit: 0 }, width: { value: 45, unit: 0 } },
    }, {
      designator: '27', trueHeading: 274, surface: { mainComposite: 2 },
    }],
  };
  it('converts elevation m → ft and maps fields', () => {
    const a = normalizeAirport(raw);
    expect(a).toMatchObject({
      icao: 'LBSF', iata: 'SOF', kind: 'INTL', elevationFt: 1742, vfr: true, ifr: true,
      lat: 42.696389, lon: 23.418056,
    });
    expect(a.frequencies[0]).toEqual({ mhz: '118.255', type: 'TWR', name: 'SOFIA TOWER', primary: true });
    expect(a.runways[0]).toMatchObject({ designator: '09', lengthM: 3600, widthM: 45, surface: 'ASPHALT', paved: true, main: true });
    expect(a.runways[1]).toMatchObject({ surface: 'GRASS', paved: false, lengthM: undefined });
  });
  it('defaults to VFR when traffic type missing; feet elevation passes through', () => {
    const a = normalizeAirport({ ...raw, trafficType: undefined, elevation: { value: 1000, unit: 1 } });
    expect(a.vfr).toBe(true);
    expect(a.ifr).toBe(false);
    expect(a.elevationFt).toBe(1000);
  });
});

describe('openAIP points', () => {
  it('reporting point resolves airport ICAO', () => {
    const rp = normalizeReportingPoint(
      { _id: 'r1', name: 'ABARU', country: 'BG', airports: ['a1', 'zz'], geometry: { type: 'Point', coordinates: [27.1, 42.5] } },
      new Map([['a1', 'LBBG']]),
    );
    expect(rp).toMatchObject({ name: 'ABARU', airports: ['LBBG'], compulsory: true, lat: 42.5, lon: 27.1 });
  });
  it('navaid frequency units', () => {
    const base = { _id: 'n', name: 'X', identifier: 'PD', country: 'BG', geometry: { type: 'Point' as const, coordinates: [24, 42] as [number, number] } };
    expect(normalizeNavaid({ ...base, type: 2, frequency: { value: '537.000', unit: 1 } })).toMatchObject({ kind: 'NDB', frequencyUnit: 'kHz' });
    expect(normalizeNavaid({ ...base, type: 7, frequency: { value: '114.900', unit: 2 } })).toMatchObject({ kind: 'DVOR-DME', frequencyUnit: 'MHz' });
  });
});
