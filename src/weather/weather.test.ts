import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  formatAge, formatTaf, formatUtc, metarAgeLevel, parseAwcMetars, parseAwcTafs, ProxyWeatherSource, tafExpired,
} from './weather';

// Shapes as returned by aviationweather.gov /api/data (trimmed)
const metars = [
  { icaoId: 'LBSF', obsTime: 1794231000, rawOb: 'METAR LBSF 091330Z VRB01KT 9999 FEW040 10/04 Q1023 NOSIG', fltCat: 'VFR' },
  { icaoId: 'LBSF', obsTime: 1794229200, rawOb: 'METAR LBSF 091300Z 12003KT 9999 SCT040 09/04 Q1023 NOSIG', fltCat: 'VFR' },
  { icaoId: 'LBPD', obsTime: 1794231000, rawOb: 'METAR LBPD 091330Z AUTO 33003KT 4000 BR OVC009 06/05 Q1024', fltCat: 'IFR' },
  { icaoId: 'BAD' },
];
const tafs = [
  { icaoId: 'LBSF', issueTime: '2026-11-09T12:28:00.000Z', validTimeFrom: 1794225600, validTimeTo: 1794312000,
    rawTAF: 'TAF LBSF 091228Z 0912/1012 VRB03KT 9999 SCT040 TEMPO 0915/0918 4000 BR BECMG 1006/1008 12010KT' },
  { icaoId: 'LBSF', issueTime: '2026-11-09T05:00:00.000Z', validTimeFrom: 1794204000, validTimeTo: 1794290400, rawTAF: 'TAF LBSF 090500Z old' },
];

describe('parsing', () => {
  it('keeps the latest METAR per station and its flight category', () => {
    const m = parseAwcMetars(metars);
    expect(m).toHaveLength(2);
    expect(m.find((x) => x.icao === 'LBSF')).toMatchObject({ raw: expect.stringContaining('091330Z'), observed: '2026-11-09T13:30:00.000Z', category: 'VFR' });
    expect(m.find((x) => x.icao === 'LBPD')?.category).toBe('IFR');
    expect(parseAwcMetars({ error: 'x' })).toEqual([]);
  });
  it('keeps the latest TAF per station', () => {
    const t = parseAwcTafs(tafs);
    expect(t).toHaveLength(1);
    expect(t[0]).toMatchObject({ icao: 'LBSF', issued: '2026-11-09T12:28:00.000Z', validFrom: '2026-11-09T12:00:00.000Z', validTo: '2026-11-10T12:00:00.000Z' });
  });
});

describe('age & formatting', () => {
  const obs = '2026-11-09T13:30:00.000Z';
  const at = (min: number) => new Date(Date.parse(obs) + min * 60000);
  it('age levels', () => {
    expect(metarAgeLevel(obs, at(25))).toBe('fresh');
    expect(metarAgeLevel(obs, at(75))).toBe('aging');
    expect(metarAgeLevel(obs, at(120))).toBe('old');
  });
  it('TAF expiry', () => {
    const t = parseAwcTafs(tafs)[0];
    expect(tafExpired(t, new Date('2026-11-10T11:59:00Z'))).toBe(false);
    expect(tafExpired(t, new Date('2026-11-10T12:01:00Z'))).toBe(true);
  });
  it('formatAge / formatUtc / formatTaf', () => {
    expect(formatAge(35.4)).toBe('35 min');
    expect(formatAge(125)).toBe('2 h 05 min');
    expect(formatAge(1500)).toBe('1 d 1 h');
    expect(formatUtc(obs)).toBe('09 13:30Z');
    expect(formatTaf('TAF LBSF 0912/1012 9999 TEMPO 0912/0918 4000 RA PROB40 TEMPO 0918/0922 4000 DZ FM100600 12010KT'))
      .toBe('TAF LBSF 0912/1012 9999\n  TEMPO 0912/0918 4000 RA\n  PROB40 TEMPO 0918/0922 4000 DZ\n  FM100600 12010KT');
    expect(formatTaf(tafs[0].rawTAF)).toBe('TAF LBSF 091228Z 0912/1012 VRB03KT 9999 SCT040\n  TEMPO 0915/0918 4000 BR\n  BECMG 1006/1008 12010KT');
  });
});

describe('ProxyWeatherSource', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('calls the proxy and parses', async () => {
    const f = vi.fn(async (url: string) => new Response(JSON.stringify(url.includes('/metar') ? metars : tafs)));
    vi.stubGlobal('fetch', f);
    const src = new ProxyWeatherSource('https://wx.example.dev/');
    expect((await src.metars(['LBSF', 'LBPD'])).length).toBe(2);
    expect(f.mock.calls[0][0]).toBe('https://wx.example.dev/metar?ids=LBSF%2CLBPD&format=json');
    expect((await src.tafs(['LBSF']))[0].icao).toBe('LBSF');
    expect(await src.metars([])).toEqual([]);
  });
  it('throws on HTTP errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('x', { status: 502 })));
    await expect(new ProxyWeatherSource('https://wx').metars(['LBSF'])).rejects.toThrow('502');
  });
});
