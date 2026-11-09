/**
 * METAR/TAF model + parsing of the aviationweather.gov Data API JSON
 * (as returned through our proxy). Source-independent shapes so another
 * provider can be plugged in later.
 */
export type FlightCategory = 'VFR' | 'MVFR' | 'IFR' | 'LIFR';

export interface Metar {
  icao: string;
  raw: string;
  /** Observation time, ISO UTC. */
  observed: string;
  category?: FlightCategory;
}

export interface Taf {
  icao: string;
  raw: string;
  issued: string;
  validFrom: string;
  validTo: string;
}

export interface WeatherSource {
  metars(ids: string[]): Promise<Metar[]>;
  tafs(ids: string[]): Promise<Taf[]>;
}

const iso = (unixSeconds: unknown): string | null =>
  typeof unixSeconds === 'number' && Number.isFinite(unixSeconds) ? new Date(unixSeconds * 1000).toISOString() : null;

const CATS = new Set(['VFR', 'MVFR', 'IFR', 'LIFR']);

/** Latest METAR per station. */
export function parseAwcMetars(json: unknown): Metar[] {
  if (!Array.isArray(json)) return [];
  const latest = new Map<string, Metar>();
  for (const r of json as Record<string, unknown>[]) {
    const icao = typeof r.icaoId === 'string' ? r.icaoId : null;
    const raw = typeof r.rawOb === 'string' ? r.rawOb.trim() : null;
    const observed = iso(r.obsTime) ?? (typeof r.reportTime === 'string' ? new Date(r.reportTime).toISOString() : null);
    if (!icao || !raw || !observed) continue;
    const m: Metar = { icao, raw, observed, category: CATS.has(String(r.fltCat)) ? (r.fltCat as FlightCategory) : undefined };
    const prev = latest.get(icao);
    if (!prev || prev.observed < observed) latest.set(icao, m);
  }
  return [...latest.values()];
}

/** Latest TAF per station. */
export function parseAwcTafs(json: unknown): Taf[] {
  if (!Array.isArray(json)) return [];
  const latest = new Map<string, Taf>();
  for (const r of json as Record<string, unknown>[]) {
    const icao = typeof r.icaoId === 'string' ? r.icaoId : null;
    const raw = typeof r.rawTAF === 'string' ? r.rawTAF.trim() : null;
    const issued = typeof r.issueTime === 'string' ? new Date(r.issueTime).toISOString() : iso(r.issueTime);
    const validFrom = iso(r.validTimeFrom);
    const validTo = iso(r.validTimeTo);
    if (!icao || !raw || !issued || !validFrom || !validTo) continue;
    const t: Taf = { icao, raw, issued, validFrom, validTo };
    const prev = latest.get(icao);
    if (!prev || prev.issued < issued) latest.set(icao, t);
  }
  return [...latest.values()];
}

/** Proxy client: GET {base}/metar?ids=… and {base}/taf?ids=… */
export class ProxyWeatherSource implements WeatherSource {
  private readonly base: string;
  constructor(base: string) {
    this.base = base.replace(/\/+$/, '');
  }
  private async get(product: 'metar' | 'taf', ids: string[]): Promise<unknown> {
    const res = await fetch(`${this.base}/${product}?ids=${encodeURIComponent(ids.join(','))}&format=json`);
    if (res.status === 204) return [];
    if (!res.ok) throw new Error(`${product}: HTTP ${res.status}`);
    return res.json();
  }
  async metars(ids: string[]) {
    return ids.length ? parseAwcMetars(await this.get('metar', ids)) : [];
  }
  async tafs(ids: string[]) {
    return ids.length ? parseAwcTafs(await this.get('taf', ids)) : [];
  }
}

export type AgeLevel = 'fresh' | 'aging' | 'old';

export const minutesSince = (isoTime: string, now = new Date()) => (now.getTime() - new Date(isoTime).getTime()) / 60000;

/** METARs are issued every 30–60 min: >60 min is getting old, >90 min is stale. */
export function metarAgeLevel(isoTime: string, now = new Date()): AgeLevel {
  const m = minutesSince(isoTime, now);
  return m <= 60 ? 'fresh' : m <= 90 ? 'aging' : 'old';
}

export const tafExpired = (t: Taf, now = new Date()) => now.getTime() > new Date(t.validTo).getTime();

/** "35 min", "2 h 05 min", "1 d 3 h". */
export function formatAge(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  if (m < 24 * 60) return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
  return `${Math.floor(m / 1440)} d ${Math.floor((m % 1440) / 60)} h`;
}

/** "091330Z"-style UTC stamp for display: "09 13:30Z". */
export function formatUtc(isoTime: string): string {
  const d = new Date(isoTime);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}Z`;
}

/** Put each TAF change group on its own line for readability. */
export function formatTaf(raw: string): string {
  // "PROB40 TEMPO …" is one group: don't break between PROBxx and TEMPO.
  return raw.replace(/(?<!PROB\d{2})\s+(?=(BECMG|TEMPO|FM\d{6}|PROB\d{2})\b)/g, '\n  ');
}
