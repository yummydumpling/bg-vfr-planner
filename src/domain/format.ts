import type { AirspaceType, Runway, VerticalLimit } from './types';

export const M_PER_FT = 0.3048;

/** Chart-style vertical limit text: "GND", "2500 ft AMSL", "1000 ft AGL", "FL 95". */
export function formatLimit(l: VerticalLimit): string {
  if (l.unit === 'FL') return `FL ${l.value}`;
  const ft = l.unit === 'M' ? Math.round(l.value / M_PER_FT) : l.value;
  if (l.ref === 'GND') return ft === 0 ? 'GND' : `${ft} ft AGL`;
  if (l.ref === 'STD') return `${ft} ft STD`;
  return `${ft} ft AMSL`;
}

/**
 * Approximate altitude in feet for sorting and comparisons.
 * AGL limits are returned as height (terrain unknown here) and flagged.
 * FL uses standard pressure (FL 95 → 9500 ft).
 */
export function limitToFeet(l: VerticalLimit): { ft: number; agl: boolean } {
  const raw = l.unit === 'FL' ? l.value * 100 : l.unit === 'M' ? l.value / M_PER_FT : l.value;
  return { ft: Math.round(raw), agl: l.ref === 'GND' };
}

export type AirspaceCategory = 'controlled' | 'atz' | 'restricted' | 'zones' | 'fir' | 'other';

const CATEGORY: Partial<Record<AirspaceType, AirspaceCategory>> = {
  CTR: 'controlled', TMA: 'controlled', CTA: 'controlled', MCTR: 'controlled',
  ATZ: 'atz', MATZ: 'atz', HTZ: 'atz', TIZ: 'atz', TIA: 'atz',
  P: 'restricted', R: 'restricted', D: 'restricted', TRA: 'restricted', TSA: 'restricted',
  MTA: 'restricted', ALERT: 'restricted', WARNING: 'restricted', PROTECTED: 'restricted',
  LOW_OVERFLIGHT: 'restricted',
  TMZ: 'zones', RMZ: 'zones', GLIDING: 'zones', SPORT: 'zones', VFR_SECTOR: 'zones', TRP: 'zones',
  FIR: 'fir', UIR: 'fir', FIS: 'fir',
};

export const airspaceCategory = (t: AirspaceType): AirspaceCategory => CATEGORY[t] ?? 'other';

/** Short label shown in lists, e.g. "CTR · C", "D", "TMA · C". */
export function airspaceBadge(type: AirspaceType, cls: string): string {
  const t = type === 'LOW_OVERFLIGHT' ? 'LOW-OVFL' : type.replace('_', ' ');
  return cls && cls !== 'SUA' ? `${t} · ${cls}` : t;
}

export interface RunwayPair {
  designators: string;
  lengthM?: number;
  widthM?: number;
  surface: Runway['surface'];
  paved: boolean;
  trueHeading: number;
}

/** Group runway ends into physical runways: 09 + 27 → "09/27". */
export function pairRunways(runways: Runway[]): RunwayPair[] {
  const used = new Set<number>();
  const out: RunwayPair[] = [];
  runways.forEach((r, i) => {
    if (used.has(i)) return;
    used.add(i);
    const j = runways.findIndex((o, k) => {
      if (used.has(k)) return false;
      // reciprocal ends differ by ~180°
      const delta = (((o.trueHeading - r.trueHeading) % 360) + 360) % 360;
      return Math.abs(delta - 180) <= 10 && sameSide(r.designator, o.designator);
    });
    const ends = [r];
    if (j >= 0) {
      used.add(j);
      ends.push(runways[j]);
    }
    ends.sort((a, b) => parseInt(a.designator, 10) - parseInt(b.designator, 10));
    out.push({
      designators: ends.map((e) => e.designator).join('/'),
      lengthM: r.lengthM ?? runways[j]?.lengthM,
      widthM: r.widthM ?? runways[j]?.widthM,
      surface: r.surface,
      paved: r.paved,
      trueHeading: ends[0].trueHeading,
    });
  });
  return out;
}

/** L pairs with R, C with C, none with none. */
function sameSide(a: string, b: string): boolean {
  const sa = a.replace(/^\d+/, '');
  const sb = b.replace(/^\d+/, '');
  if (!sa && !sb) return true;
  return (sa === 'L' && sb === 'R') || (sa === 'R' && sb === 'L') || (sa === 'C' && sb === 'C');
}

export function formatVariation(deg: number): string {
  const abs = Math.abs(deg).toFixed(1);
  return deg >= 0 ? `${abs}° E` : `${abs}° W`;
}
