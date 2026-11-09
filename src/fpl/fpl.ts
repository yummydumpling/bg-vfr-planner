/**
 * ICAO flight plan (PANS-ATM Doc 4444 format, items 7–19) for VFR flights.
 * Pure functions: the UI collects the inputs, this module formats them.
 */
import type { Waypoint } from '../domain/types';
import { formatItem15Coord } from '../nav/coords';

export type FlightRules = 'V' | 'I' | 'Y' | 'Z';
export type FlightType = 'G' | 'S' | 'N' | 'M' | 'X';
export type Wake = 'L' | 'M' | 'H' | 'J';

export interface FplInput {
  /** Item 7: aircraft identification, e.g. "LZABC" (hyphens removed). */
  aircraftId: string;
  flightRules: FlightRules;
  flightType: FlightType;
  /** Item 9: ICAO type designator; empty → ZZZZ + TYP/ in item 18. */
  aircraftType: string;
  /** Free-text type for TYP/ when the designator is unknown. */
  typeText?: string;
  wake: Wake;
  /** Item 10a, e.g. "SY". */
  equipment: string;
  /** Item 10b, e.g. "C". */
  surveillance: string;
  /** Estimated off-block time (UTC). */
  eobt: Date;
  /** Cruising speed (TAS), knots. */
  speedKt: number;
  /** Cruising level: 'VFR' or an altitude in feet (→ A045). */
  level: 'VFR' | number;
  waypoints: Waypoint[];
  /** Use names for VFR reporting points instead of coordinates. */
  reportingPointNames?: boolean;
  /** Total EET, minutes. */
  eetMin: number;
  alternates: string[];
  /** Registration as painted, e.g. "LZ-ABC" (REG/ is written without hyphen). */
  registration?: string;
  /** Extra item 18 text, e.g. "RMK/PIC PHONE 0888123456". */
  remarks?: string;
  // Item 19
  enduranceMin: number;
  persons?: number;
  /** Emergency radio: U (UHF 243), V (VHF 121.5), E (ELT). */
  radio?: string;
  /** Survival equipment: P polar, D desert, M maritime, J jungle. */
  survival?: string;
  /** Life jackets: L light, F fluorescein, U UHF, V VHF. */
  jackets?: string;
  colour?: string;
  pilot?: string;
}

const pad = (n: number, w: number) => String(Math.max(0, Math.floor(n))).padStart(w, '0');

/** Minutes → HHMM (rounded up to the next minute, as is usual for EET). */
export function hhmm(min: number, roundUp = true): string {
  const m = roundUp ? Math.ceil(min - 1e-9) : Math.floor(min + 1e-9);
  return pad(Math.floor(m / 60), 2) + pad(m % 60, 2);
}

export const cleanId = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

export function speedField(kt: number): string {
  return `N${pad(Math.round(kt), 4)}`;
}

export function levelField(level: 'VFR' | number): string {
  if (level === 'VFR') return 'VFR';
  return `A${pad(Math.round(level / 100), 3)}`;
}

const isAerodrome = (w: Waypoint) => w.kind === 'airport' && /^[A-Z]{4}$/.test(w.name);
/** Published 2–5 letter designators (navaids, 5-letter named points). */
const isDesignator = (w: Waypoint, rpNames: boolean) =>
  (w.kind === 'navaid' && /^[A-Z]{2,3}$/.test(w.name)) ||
  (rpNames && w.kind === 'reporting' && /^[A-Z]{5}$/.test(w.name));

export function pointDesignator(w: Waypoint, rpNames = false): string {
  return isDesignator(w, rpNames) ? w.name : formatItem15Coord(w.lat, w.lon);
}

/** Item 13 / 16 aerodrome: ICAO code or ZZZZ (then DEP/ or DEST/ in item 18). */
export function aerodromeField(w: Waypoint | undefined): { code: string; item18?: string } {
  if (!w) return { code: 'ZZZZ' };
  if (isAerodrome(w)) return { code: w.name };
  return { code: 'ZZZZ', item18: formatItem15Coord(w.lat, w.lon) };
}

/** Item 15: speed, level and route of significant points joined by DCT. */
export function buildItem15(f: Pick<FplInput, 'speedKt' | 'level' | 'waypoints' | 'reportingPointNames'>): string {
  const inner = f.waypoints.slice(1, -1);
  const parts = [`${speedField(f.speedKt)}${levelField(f.level)}`];
  for (const w of inner) parts.push('DCT', pointDesignator(w, !!f.reportingPointNames));
  parts.push('DCT');
  return parts.join(' ');
}

export function buildItem18(f: FplInput): string {
  const parts: string[] = [];
  const dep = aerodromeField(f.waypoints[0]);
  const dest = aerodromeField(f.waypoints[f.waypoints.length - 1]);
  const d = f.eobt;
  parts.push(`DOF/${pad(d.getUTCFullYear() % 100, 2)}${pad(d.getUTCMonth() + 1, 2)}${pad(d.getUTCDate(), 2)}`);
  const reg = f.registration ? cleanId(f.registration) : '';
  if (reg) parts.push(`REG/${reg}`);
  if (!f.aircraftType) parts.push(`TYP/${(f.typeText || 'UNKNOWN').toUpperCase()}`);
  if (dep.item18) parts.push(`DEP/${dep.item18}`);
  if (dest.item18) parts.push(`DEST/${dest.item18}`);
  if (f.remarks?.trim()) parts.push(f.remarks.trim().toUpperCase());
  return parts.length ? parts.join(' ') : '0';
}

export interface FplFields {
  item7: string;
  item8: string;
  item9: string;
  item10: string;
  item13: string;
  item15: string;
  item16: string;
  item18: string;
  item19: string;
}

export function buildFields(f: FplInput): FplFields {
  const dep = aerodromeField(f.waypoints[0]);
  const dest = aerodromeField(f.waypoints[f.waypoints.length - 1]);
  const eobt = pad(f.eobt.getUTCHours(), 2) + pad(f.eobt.getUTCMinutes(), 2);
  const alt = f.alternates.map((a) => a.trim().toUpperCase()).filter((a) => /^[A-Z]{4}$/.test(a)).slice(0, 2);
  return {
    item7: cleanId(f.aircraftId),
    item8: `${f.flightRules}${f.flightType}`,
    item9: `${f.aircraftType ? f.aircraftType.toUpperCase() : 'ZZZZ'}/${f.wake}`,
    item10: `${f.equipment.toUpperCase() || 'N'}/${f.surveillance.toUpperCase() || 'N'}`,
    item13: `${dep.code}${eobt}`,
    item15: buildItem15(f),
    item16: [`${dest.code}${hhmm(f.eetMin)}`, ...alt].join(' '),
    item18: buildItem18(f),
    item19: buildItem19(f),
  };
}

/** Item 19 supplementary information (kept by ARO, not in the ATS message). */
export function buildItem19(f: FplInput): string {
  const parts = [`E/${hhmm(f.enduranceMin, false)}`];
  parts.push(`P/${f.persons && f.persons > 0 ? pad(f.persons, 3) : 'TBN'}`);
  if (f.radio) parts.push(`R/${f.radio.toUpperCase()}`);
  if (f.survival) parts.push(`S/${f.survival.toUpperCase()}`);
  if (f.jackets) parts.push(`J/${f.jackets.toUpperCase()}`);
  if (f.colour?.trim()) parts.push(`A/${f.colour.trim().toUpperCase()}`);
  if (f.pilot?.trim()) parts.push(`C/${f.pilot.trim().toUpperCase()}`);
  return parts.join(' ');
}

/** ATS message text "(FPL-…)" with items 7–18. */
export function buildFplMessage(f: FplInput): string {
  const x = buildFields(f);
  return [
    `(FPL-${x.item7}-${x.item8}`,
    `-${x.item9}-${x.item10}`,
    `-${x.item13}`,
    `-${x.item15}`,
    `-${x.item16}`,
    `-${x.item18})`,
  ].join('\n');
}

export type FplProblem = 'aircraftId' | 'route' | 'eobtPast' | 'speed';

export function checkFpl(f: FplInput, now = new Date()): FplProblem[] {
  const p: FplProblem[] = [];
  if (!/^[A-Z0-9]{2,7}$/.test(cleanId(f.aircraftId))) p.push('aircraftId');
  if (f.waypoints.length < 2) p.push('route');
  if (f.eobt.getTime() < now.getTime() - 5 * 60 * 1000) p.push('eobtPast');
  if (!(f.speedKt > 0 && f.speedKt < 10000)) p.push('speed');
  return p;
}
