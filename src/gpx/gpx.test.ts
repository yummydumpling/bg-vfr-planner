import { describe, expect, it } from 'vitest';
import type { AeroData } from '../data/source';
import type { Waypoint } from '../domain/types';
import { MAX_TRACK_POINTS, parseGpx, routeToGpx } from './gpx';
import { gpxToWaypoints } from './match';

const wps: Waypoint[] = [
  { id: '1', lat: 42.696389, lon: 23.418056, name: 'LBSF', kind: 'airport', refId: 'ap1' },
  { id: '2', lat: 42.55, lon: 24, name: 'Lake <"A&B">', kind: 'user' },
  { id: '3', lat: 42.0678, lon: 24.8508, name: 'LBPD', kind: 'airport', refId: 'ap2' },
];

describe('GPX export / import', () => {
  it('round-trips a route including special characters and kinds', () => {
    const xml = routeToGpx('Sofia – Plovdiv', wps, new Date('2026-11-09T12:00:00Z'));
    expect(xml).toContain('<rte>');
    expect(xml).toContain('Lake &lt;&quot;A&amp;B&quot;&gt;');
    const r = parseGpx(xml);
    expect(r.source).toBe('rte');
    expect(r.name).toBe('Sofia – Plovdiv');
    expect(r.points.map((p) => p.name)).toEqual(['LBSF', 'Lake <"A&B">', 'LBPD']);
    expect(r.points[1]).toMatchObject({ lat: 42.55, lon: 24, kind: 'user' });
  });

  it('reads waypoint files with single quotes, namespaces, CDATA and lon-before-lat', () => {
    const xml = `<?xml version='1.0'?><gpx:gpx xmlns:gpx='http://www.topografix.com/GPX/1/1'><gpx:metadata><gpx:name>Trip</gpx:name></gpx:metadata>
      <gpx:wpt lon='23.418' lat='42.696'><gpx:name><![CDATA[LBSF]]></gpx:name></gpx:wpt>
      <gpx:wpt lat='42.0678' lon='24.8508'/></gpx:gpx>`;
    const r = parseGpx(xml);
    expect(r).toMatchObject({ source: 'wpt', name: 'Trip' });
    expect(r.points).toEqual([{ lat: 42.696, lon: 23.418, name: 'LBSF', kind: undefined }, { lat: 42.0678, lon: 24.8508, name: '', kind: undefined }]);
  });

  it('reduces long tracks', () => {
    const pts = Array.from({ length: 500 }, (_, i) => `<trkpt lat="${42 + i / 1000}" lon="25"></trkpt>`).join('');
    const r = parseGpx(`<gpx><trk><trkseg>${pts}</trkseg></trk></gpx>`);
    expect(r.source).toBe('trk');
    expect(r.points).toHaveLength(MAX_TRACK_POINTS);
    expect(r.points[0].lat).toBe(42);
    expect(r.points[MAX_TRACK_POINTS - 1].lat).toBeCloseTo(42.499, 6);
  });

  it('rejects non-GPX and empty files', () => {
    expect(() => parseGpx('<kml></kml>')).toThrow('not-gpx');
    expect(() => parseGpx('<gpx><wpt lat="1" lon="2"/></gpx>')).toThrow('no-points');
  });
});

describe('matching imported points', () => {
  const data = {
    airports: [{ id: 'ap1', icao: 'LBSF', name: 'SOFIA', lat: 42.696389, lon: 23.418056 }],
    reportingPoints: [{ id: 'rp1', name: 'EVLOD', lat: 42.637, lon: 23.309 }],
    navaids: [{ id: 'n1', ident: 'BLO', lat: 42.80, lon: 24.20 }],
  } as unknown as AeroData;

  it('recognises aerodromes, reporting points and navaids by name or position', () => {
    const out = gpxToWaypoints([
      { lat: 42.70, lon: 23.42, name: 'lbsf' },        // by name, slightly off
      { lat: 42.6371, lon: 23.3091, name: 'Turn 1' },  // by position
      { lat: 42.81, lon: 24.21, name: 'BLO' },          // navaid by ident
      { lat: 42.5, lon: 24.5, name: '' },               // free point
      { lat: 42.4, lon: 24.6, name: 'My farm' },
    ], data);
    expect(out.map((w) => [w.kind, w.name])).toEqual([
      ['airport', 'LBSF'], ['reporting', 'EVLOD'], ['navaid', 'BLO'], ['user', '4230N02430E'], ['user', 'My farm'],
    ]);
    expect(out[0].lat).toBe(42.696389); // snapped to the aerodrome position
    expect(new Set(out.map((w) => w.id)).size).toBe(5);
  });

  it('a far-away point with an aerodrome name is not matched', () => {
    expect(gpxToWaypoints([{ lat: 44, lon: 28, name: 'LBSF' }], data)[0].kind).toBe('user');
  });
});
