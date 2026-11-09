import { describe, expect, it } from 'vitest';
import type { Waypoint } from '../domain/types';
import {
  aerodromeField, buildFields, buildFplMessage, buildItem15, buildItem19, checkFpl, hhmm, levelField, speedField,
  type FplInput,
} from './fpl';

const ap = (name: string, lat: number, lon: number): Waypoint => ({ id: name, name, lat, lon, kind: 'airport' });
const user = (lat: number, lon: number): Waypoint => ({ id: `${lat}`, name: 'x', lat, lon, kind: 'user' });
const nav = (name: string, lat: number, lon: number): Waypoint => ({ id: name, name, lat, lon, kind: 'navaid' });
const rp = (name: string, lat: number, lon: number): Waypoint => ({ id: name, name, lat, lon, kind: 'reporting' });

const base: FplInput = {
  aircraftId: 'LZ-ABC', flightRules: 'V', flightType: 'G', aircraftType: 'C172', wake: 'L',
  equipment: 'SY', surveillance: 'C', eobt: new Date(Date.UTC(2026, 10, 10, 8, 30)),
  speedKt: 105, level: 'VFR',
  waypoints: [ap('LBSF', 42.6964, 23.4181), user(42 + 33 / 60, 24), nav('BLO', 42.8, 24.2), ap('LBPD', 42.0678, 24.8508)],
  eetMin: 44.2, alternates: ['lbsf', 'XX', 'LBWN', 'LBBG'], registration: 'LZ-ABC',
  enduranceMin: 365.6, persons: 2, radio: 'VE', colour: 'white blue', pilot: 'Ivan Petrov',
};

describe('field formatting', () => {
  it('speed / level / hhmm', () => {
    expect(speedField(105)).toBe('N0105');
    expect(speedField(95.4)).toBe('N0095');
    expect(levelField('VFR')).toBe('VFR');
    expect(levelField(4500)).toBe('A045');
    expect(levelField(10500)).toBe('A105');
    expect(hhmm(44.2)).toBe('0045');
    expect(hhmm(60)).toBe('0100');
    expect(hhmm(365.6, false)).toBe('0605');
  });
  it('aerodrome or ZZZZ', () => {
    expect(aerodromeField(ap('LBSF', 1, 2))).toEqual({ code: 'LBSF' });
    expect(aerodromeField(user(42.5, 25.25))).toEqual({ code: 'ZZZZ', item18: '4230N02515E' });
  });
});

describe('item 15', () => {
  it('speed+level then DCT between intermediate points; navaids by ident, others by coordinates', () => {
    expect(buildItem15(base)).toBe('N0105VFR DCT 4233N02400E DCT BLO DCT');
  });
  it('direct flight', () => {
    expect(buildItem15({ ...base, waypoints: [base.waypoints[0], base.waypoints[3]] })).toBe('N0105VFR DCT');
  });
  it('altitude level and reporting point names option', () => {
    const wps = [base.waypoints[0], rp('EVLOD', 42.637, 23.309), rp('Lake', 42.5, 23.5), base.waypoints[3]];
    expect(buildItem15({ ...base, level: 4500, waypoints: wps })).toBe('N0105A045 DCT 4238N02319E DCT 4230N02330E DCT');
    expect(buildItem15({ ...base, waypoints: wps, reportingPointNames: true })).toBe('N0105VFR DCT EVLOD DCT 4230N02330E DCT');
  });
  it('an aerodrome in the middle of the route is given as coordinates', () => {
    const wps = [base.waypoints[0], ap('LBPG', 42.29, 24.71), base.waypoints[3]];
    expect(buildItem15({ ...base, waypoints: wps })).toBe('N0105VFR DCT 4217N02443E DCT');
  });
});

describe('full flight plan', () => {
  it('fields', () => {
    const f = buildFields(base);
    expect(f).toMatchObject({
      item7: 'LZABC', item8: 'VG', item9: 'C172/L', item10: 'SY/C', item13: 'LBSF0830',
      item16: 'LBPD0045 LBSF LBWN', item18: 'DOF/261110 REG/LZABC',
      item19: 'E/0605 P/002 R/VE A/WHITE BLUE C/IVAN PETROV',
    });
  });
  it('ATS message', () => {
    expect(buildFplMessage(base)).toBe(
      '(FPL-LZABC-VG\n-C172/L-SY/C\n-LBSF0830\n-N0105VFR DCT 4233N02400E DCT BLO DCT\n-LBPD0045 LBSF LBWN\n-DOF/261110 REG/LZABC)',
    );
  });
  it('unknown type and off-aerodrome departure use ZZZZ with TYP/ and DEP/', () => {
    const f = buildFields({ ...base, aircraftType: '', typeText: 'Zlin 142', waypoints: [user(42.5, 25.25), base.waypoints[3]], remarks: 'rmk/pic tel 0888' });
    expect(f.item9).toBe('ZZZZ/L');
    expect(f.item13).toBe('ZZZZ0830');
    expect(f.item18).toBe('DOF/261110 REG/LZABC TYP/ZLIN 142 DEP/4230N02515E RMK/PIC TEL 0888');
  });
  it('item 19 defaults', () => {
    expect(buildItem19({ ...base, persons: undefined, radio: '', colour: '', pilot: '' })).toBe('E/0605 P/TBN');
  });
  it('checks', () => {
    expect(checkFpl(base, new Date(Date.UTC(2026, 10, 10, 7)))).toEqual([]);
    expect(checkFpl({ ...base, aircraftId: '' , waypoints: [] }, new Date(Date.UTC(2026, 10, 11)))).toEqual(['aircraftId', 'route', 'eobtPast']);
  });
});
