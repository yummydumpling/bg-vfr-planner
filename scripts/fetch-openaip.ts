/**
 * Download a Bulgaria (+ border buffer) snapshot from the openAIP Core API and
 * write normalised static data to public/data/bg/.
 *
 *   OPENAIP_API_KEY=... npm run data:fetch     (or put it in .env.local)
 *
 * The key is only used here, at build time; it is never shipped to browsers.
 * openAIP data © openAIP contributors, CC BY-NC 4.0 — https://www.openaip.net
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DatasetMeta } from '../src/domain/types';
import {
  normalizeAirport, normalizeAirspace, normalizeNavaid, normalizeReportingPoint,
  type OaAirport, type OaAirspace, type OaNavaid, type OaReportingPoint,
} from '../src/data/openaip/normalize';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'public/data/bg');
const API = 'https://api.core.openaip.net/api';
const HOME = 'BG';
const NEIGHBOURS = ['RO', 'RS', 'MK', 'GR', 'TR'];
/** Neighbour features are kept only if they touch this box [W, S, E, N]. */
const AIRSPACE_BOX: [number, number, number, number] = [21.8, 40.7, 31.6, 44.9];
const POINT_BOX: [number, number, number, number] = [22.0, 41.0, 29.0, 44.5];

function apiKey(): string {
  if (process.env.OPENAIP_API_KEY) return process.env.OPENAIP_API_KEY;
  const envFile = resolve(ROOT, '.env.local');
  if (existsSync(envFile)) {
    const m = /^OPENAIP_API_KEY=(.+)$/m.exec(readFileSync(envFile, 'utf8'));
    if (m) return m[1].trim();
  }
  throw new Error('OPENAIP_API_KEY not set (env var or .env.local)');
}

async function fetchAll<T>(resource: string, country: string): Promise<T[]> {
  const key = apiKey();
  const items: T[] = [];
  for (let page = 1; ; page++) {
    const url = `${API}/${resource}?country=${country}&limit=1000&page=${page}`;
    let res: Response | undefined;
    for (let attempt = 0; attempt < 4; attempt++) {
      res = await fetch(url, { headers: { 'x-openaip-api-key': key, 'User-Agent': 'BG-VFR-Planner data script' } });
      if (res.status !== 429 && res.status < 500) break;
      await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
    }
    if (!res!.ok) throw new Error(`${resource} ${country} page ${page}: HTTP ${res!.status}`);
    const body = (await res!.json()) as { items: T[]; totalPages: number };
    items.push(...body.items);
    if (page >= body.totalPages) break;
  }
  return items;
}

const inBox = ([w, s, e, n]: number[], lon: number, lat: number) => lon >= w && lon <= e && lat >= s && lat <= n;

function geometryTouchesBox(g: GeoJSON.Polygon | GeoJSON.MultiPolygon, box: number[]): boolean {
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const p of polys) for (const [x, y] of p[0]) {
    minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  // bbox overlap
  return !(maxX < box[0] || minX > box[2] || maxY < box[1] || minY > box[3]);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const countries = [HOME, ...NEIGHBOURS];

  const airspaces: OaAirspace[] = [];
  const airports: OaAirport[] = [];
  const rps: OaReportingPoint[] = [];
  const navaids: OaNavaid[] = [];

  for (const c of countries) {
    const home = c === HOME;
    process.stdout.write(`${c}: `);
    const as = (await fetchAll<OaAirspace>('airspaces', c)).filter(
      (a) => a.geometry && (home || geometryTouchesBox(a.geometry, AIRSPACE_BOX)),
    );
    const ap = (await fetchAll<OaAirport>('airports', c)).filter(
      (a) => home || inBox(POINT_BOX, ...a.geometry.coordinates),
    );
    const rp = (await fetchAll<OaReportingPoint>('reporting-points', c)).filter(
      (a) => home || inBox(POINT_BOX, ...a.geometry.coordinates),
    );
    const na = (await fetchAll<OaNavaid>('navaids', c)).filter(
      (a) => home || inBox(POINT_BOX, ...a.geometry.coordinates),
    );
    console.log(`${as.length} airspaces, ${ap.length} airports, ${rp.length} reporting points, ${na.length} navaids`);
    airspaces.push(...as);
    airports.push(...ap);
    rps.push(...rp);
    navaids.push(...na);
  }

  // Reporting points reference airports by id; we need ICAO codes even for
  // airports outside the box, so resolve against everything we downloaded.
  const icaoById = new Map(airports.filter((a) => a.icaoCode).map((a) => [a._id, a.icaoCode!]));

  // Stable order so an unchanged dataset produces identical files.
  const byId = <T extends { id: string }>(a: T, b: T) => a.id.localeCompare(b.id);
  const airspaceFeatures = airspaces.map(normalizeAirspace).sort((a, b) => a.properties.id.localeCompare(b.properties.id));
  const airspaceFc: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: airspaceFeatures };
  const out: Record<string, unknown> = {
    'airspaces.geojson': airspaceFc,
    'airports.json': airports.map(normalizeAirport).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)),
    'reporting-points.json': rps.map((p) => normalizeReportingPoint(p, icaoById)).sort(byId),
    'navaids.json': navaids.map(normalizeNavaid).sort(byId),
  };
  const counts = {
    airspaces: airspaceFeatures.length,
    airports: (out['airports.json'] as unknown[]).length,
    reportingPoints: (out['reporting-points.json'] as unknown[]).length,
    navaids: (out['navaids.json'] as unknown[]).length,
  };

  // Safety net: an API hiccup must never replace good data with a near-empty set.
  const metaFile = resolve(OUT, 'meta.json');
  const previous = existsSync(metaFile) ? (JSON.parse(readFileSync(metaFile, 'utf8')) as DatasetMeta) : null;
  for (const [k, n] of Object.entries(counts)) {
    const before = previous?.counts?.[k] ?? 0;
    if (n === 0 || (before > 0 && n < before * 0.8)) {
      throw new Error(`Suspicious data: ${k} ${before} → ${n}. Not updating.`);
    }
  }

  let changed = false;
  for (const [file, data] of Object.entries(out)) {
    const path = resolve(OUT, file);
    const text = JSON.stringify(data);
    if (!existsSync(path) || readFileSync(path, 'utf8') !== text) {
      writeFileSync(path, text);
      changed = true;
    }
  }

  if (changed || !previous) {
    const meta: DatasetMeta = {
      source: 'openAIP',
      sourceUrl: 'https://www.openaip.net',
      licence: 'CC BY-NC 4.0',
      licenceUrl: 'https://creativecommons.org/licenses/by-nc/4.0/',
      attribution: '© openAIP contributors (openaip.net), CC BY-NC 4.0',
      // When the data last changed (the daily check time is published separately in status.json)
      fetchedAt: new Date().toISOString(),
      countries,
      counts,
    };
    writeFileSync(metaFile, JSON.stringify(meta, null, 2));
  }
  console.log(changed ? 'Data CHANGED' : 'Data unchanged', counts);
  // Tell GitHub Actions whether to commit and publish new data
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
