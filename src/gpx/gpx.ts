/**
 * GPX 1.1 import/export for routes.
 * Export writes a <rte> (what SkyDemon, Garmin, ForeFlight etc. import as a route).
 * Import accepts <rte> (first route), else <wpt> list; tracks are reduced to
 * at most MAX_TRACK_POINTS evenly spaced points.
 * Parsing is regex-based so it works without a DOM (and in tests).
 */
import type { Waypoint, WaypointKind } from '../domain/types';

export const MAX_TRACK_POINTS = 30;

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

const unesc = (s: string) =>
  s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&amp;/g, '&');

export function routeToGpx(name: string, wps: Waypoint[], now = new Date()): string {
  const pts = wps
    .map(
      (w) =>
        `    <rtept lat="${w.lat.toFixed(6)}" lon="${w.lon.toFixed(6)}">\n` +
        `      <name>${esc(w.name)}</name>\n` +
        `      <type>${w.kind}</type>\n` +
        `    </rtept>`,
    )
    .join('\n');
  const title = esc(name || `${wps[0]?.name ?? ''}-${wps[wps.length - 1]?.name ?? ''}`);
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="BG VFR Planner" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${title}</name>
    <time>${now.toISOString()}</time>
  </metadata>
  <rte>
    <name>${title}</name>
${pts}
  </rte>
</gpx>
`;
}

export interface GpxPoint {
  lat: number;
  lon: number;
  name: string;
  /** Our own kind when the file was written by this app. */
  kind?: WaypointKind;
}

export interface GpxRoute {
  name: string;
  points: GpxPoint[];
  source: 'rte' | 'wpt' | 'trk';
}

function attr(tag: string, name: string): number | null {
  const m = new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`).exec(tag);
  const v = m ? Number(m[1]) : NaN;
  return Number.isFinite(v) ? v : null;
}

function child(body: string, tag: string): string | undefined {
  const m = new RegExp(`<(?:\\w+:)?${tag}\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?${tag}>`).exec(body);
  return m ? unesc(m[1]).trim() : undefined;
}

function points(xml: string, tag: string): GpxPoint[] {
  const re = new RegExp(`<(?:\\w+:)?${tag}\\b([^>]*?)(?:/>|>([\\s\\S]*?)</(?:\\w+:)?${tag}>)`, 'g');
  const out: GpxPoint[] = [];
  for (const m of xml.matchAll(re)) {
    const lat = attr(m[1], 'lat');
    const lon = attr(m[1], 'lon');
    if (lat == null || lon == null || Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
    const body = m[2] ?? '';
    const type = child(body, 'type');
    const kind = (['user', 'airport', 'reporting', 'navaid'] as const).find((k) => k === type);
    out.push({ lat, lon, name: child(body, 'name') ?? '', kind });
  }
  return out;
}

/** Parse a GPX document; throws on files without usable points. */
export function parseGpx(xml: string): GpxRoute {
  if (!/<gpx\b/i.test(xml)) throw new Error('not-gpx');
  const rte = /<(?:\w+:)?rte\b[^>]*>([\s\S]*?)<\/(?:\w+:)?rte>/.exec(xml);
  const docName = child(xml.replace(/<(?:\w+:)?(rte|wpt|trk)\b[\s\S]*$/, ''), 'name') ?? '';
  if (rte) {
    const pts = points(rte[1], 'rtept');
    if (pts.length >= 2) return { name: child(rte[1].replace(/<(?:\w+:)?rtept\b[\s\S]*$/, ''), 'name') || docName, points: pts, source: 'rte' };
  }
  const wpts = points(xml, 'wpt');
  if (wpts.length >= 2) return { name: docName, points: wpts, source: 'wpt' };
  const trk = points(xml, 'trkpt');
  if (trk.length >= 2) {
    const n = Math.min(MAX_TRACK_POINTS, trk.length);
    const pick = Array.from({ length: n }, (_, i) => trk[Math.round((i * (trk.length - 1)) / (n - 1))]);
    return { name: docName, points: pick, source: 'trk' };
  }
  throw new Error('no-points');
}
