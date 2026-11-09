/**
 * Which airspaces does the route pass through, where (distance along the
 * route) and how does the planned cruise altitude relate to their limits?
 *
 * Horizontal: the great-circle route is sampled every `stepNm`; whenever the
 * inside/outside state of an airspace changes between two samples the
 * boundary is refined by bisection (~0.01 NM).
 * Vertical: compared at the single planned cruise altitude (no climb/descent
 * profile yet — airspace around the departure/destination is flagged).
 */
import { limitToFeet } from '../domain/format';
import type { AirspaceProps, AirspaceType, VerticalLimit, Waypoint } from '../domain/types';
import type { AirspaceCollection } from '../data/source';
import { distanceNm, intermediatePoint, type LatLon } from '../nav/geo';
import { pointInGeometry } from './geometry';

/** Not useful for VFR crossing checks (boundaries of the whole FIR, ATC sectors). */
const IGNORED: ReadonlySet<AirspaceType> = new Set(['FIR', 'UIR', 'FIS', 'ACC']);

/** Altitudes within this many feet of a limit are flagged as marginal. */
export const MARGIN_FT = 500;

export type VerticalStatus = 'inside' | 'below' | 'above' | 'check';

export interface VerticalAssessment {
  status: VerticalStatus;
  /** Cruise altitude is within MARGIN_FT of a limit (QNH/FL conversion matters). */
  marginal: boolean;
  /** A non-zero limit is referenced to the ground; terrain needed to decide. */
  aglLimit: boolean;
}

export interface Crossing {
  airspace: AirspaceProps;
  /** Distance from the departure point where the route enters, NM. */
  entryNm: number;
  exitNm: number;
  /** Leg index (0-based) where the route enters. */
  entryLeg: number;
  /** Where the route enters (the departure point if it starts inside). */
  entryPoint: LatLon;
  /** The departure point itself is inside. */
  atDeparture: boolean;
  /** The destination point itself is inside. */
  atDestination: boolean;
  vertical: VerticalAssessment;
}

/** Compare a planned altitude (ft AMSL) with an airspace's vertical limits. */
export function assessVertical(altFt: number, lower: VerticalLimit, upper: VerticalLimit): VerticalAssessment {
  const lo = limitToFeet(lower);
  const hi = limitToFeet(upper);
  const loAgl = lo.agl && lo.ft > 0;
  const hiAgl = hi.agl;
  const marginal = (!lo.agl || lo.ft === 0 ? Math.abs(altFt - lo.ft) < MARGIN_FT && lo.ft > 0 : false)
    || (!hiAgl && Math.abs(altFt - hi.ft) < MARGIN_FT);

  // Upper limit referenced to ground: we know we're inside only if below its
  // height (terrain ≥ 0) and above the lower limit; otherwise undecidable.
  if (loAgl || hiAgl) {
    const aboveLower = lo.agl ? (lo.ft === 0 ? true : null) : altFt >= lo.ft;
    const belowUpper = hiAgl ? (altFt <= hi.ft ? true : null) : altFt <= hi.ft;
    if (aboveLower === false) return { status: 'below', marginal, aglLimit: true };
    if (belowUpper === false) return { status: 'above', marginal, aglLimit: true };
    if (aboveLower && belowUpper) return { status: 'inside', marginal, aglLimit: true };
    return { status: 'check', marginal, aglLimit: true };
  }
  if (altFt < lo.ft) return { status: 'below', marginal, aglLimit: false };
  if (altFt > hi.ft) return { status: 'above', marginal, aglLimit: false };
  return { status: 'inside', marginal, aglLimit: false };
}

type Box = [number, number, number, number]; // W S E N

const boxCache = new WeakMap<object, Box>();
function geometryBox(g: GeoJSON.Polygon | GeoJSON.MultiPolygon): Box {
  const cached = boxCache.get(g);
  if (cached) return cached;
  let [w, s, e, n] = [Infinity, Infinity, -Infinity, -Infinity];
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  for (const poly of polys) for (const [x, y] of poly[0]) {
    if (x < w) w = x; if (x > e) e = x; if (y < s) s = y; if (y > n) n = y;
  }
  const box: Box = [w, s, e, n];
  boxCache.set(g, box);
  return box;
}

const overlaps = (a: Box, b: Box) => !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]);

function legBox(a: LatLon, b: LatLon, padDeg = 0.05): Box {
  // Great circles bulge slightly poleward; pad the box to be safe.
  return [Math.min(a.lon, b.lon) - padDeg, Math.min(a.lat, b.lat) - padDeg, Math.max(a.lon, b.lon) + padDeg, Math.max(a.lat, b.lat) + padDeg];
}

export interface CrossingOptions {
  stepNm?: number;
}

export function routeCrossings(
  fc: AirspaceCollection,
  wps: Waypoint[] | LatLon[],
  cruiseAltFt: number,
  opts: CrossingOptions = {},
): Crossing[] {
  if (wps.length < 2) return [];
  const step = opts.stepNm ?? 0.2;

  const legs = [];
  let cum = 0;
  for (let i = 0; i < wps.length - 1; i++) {
    const a = wps[i];
    const b = wps[i + 1];
    const d = distanceNm(a, b);
    legs.push({ a, b, d, start: cum, box: legBox(a, b) });
    cum += d;
  }
  const total = cum;
  const routeBox: Box = [
    Math.min(...legs.map((l) => l.box[0])), Math.min(...legs.map((l) => l.box[1])),
    Math.max(...legs.map((l) => l.box[2])), Math.max(...legs.map((l) => l.box[3])),
  ];

  const out: Crossing[] = [];
  for (const f of fc.features) {
    const props = f.properties;
    if (IGNORED.has(props.type)) continue;
    const box = geometryBox(f.geometry);
    if (!overlaps(box, routeBox)) continue;
    const inside = (p: LatLon) => pointInGeometry(p, f.geometry);
    const vertical = assessVertical(cruiseAltFt, props.lower, props.upper);

    let state = inside(wps[0]);
    let entry = state ? 0 : -1;
    let entryLeg = 0;
    let entryPoint: LatLon = { lat: wps[0].lat, lon: wps[0].lon };
    const atDeparture = state;

    for (let i = 0; i < legs.length; i++) {
      const leg = legs[i];
      if (!state && !overlaps(leg.box, box)) continue;
      const n = Math.max(1, Math.ceil(leg.d / step));
      let prevF = 0;
      for (let k = 1; k <= n; k++) {
        const fr = k / n;
        const cur = inside(intermediatePoint(leg.a, leg.b, fr));
        if (cur !== state) {
          // bisection between prevF (state) and fr (cur)
          let lo = prevF;
          let hi = fr;
          for (let it = 0; it < 14; it++) {
            const mid = (lo + hi) / 2;
            if (inside(intermediatePoint(leg.a, leg.b, mid)) === state) lo = mid;
            else hi = mid;
          }
          const frac = (lo + hi) / 2;
          const at = leg.start + frac * leg.d;
          if (cur) {
            entry = at;
            entryLeg = i;
            entryPoint = intermediatePoint(leg.a, leg.b, frac);
          } else {
            out.push({ airspace: props, entryNm: entry, exitNm: at, entryLeg, entryPoint, atDeparture: atDeparture && entry === 0, atDestination: false, vertical });
          }
          state = cur;
        }
        prevF = fr;
      }
    }
    if (state) {
      out.push({ airspace: props, entryNm: entry, exitNm: total, entryLeg, entryPoint, atDeparture: atDeparture && entry === 0, atDestination: true, vertical });
    }
  }
  return out.sort(
    (x, y) => x.entryNm - y.entryNm || limitToFeet(x.airspace.lower).ft - limitToFeet(y.airspace.lower).ft,
  );
}

/** Severity used for ordering/colouring in the UI. */
export function crossingSeverity(c: Crossing): 'danger' | 'warn' | 'info' | 'none' {
  const t = c.airspace.type;
  const relevant = c.vertical.status === 'inside' || c.vertical.status === 'check' || c.vertical.marginal;
  if (!relevant) return 'none';
  if (t === 'P' || t === 'R' || t === 'D' || t === 'TRA' || t === 'TSA' || t === 'MTA' || t === 'PROTECTED') return 'danger';
  if (['A', 'B', 'C', 'D'].includes(c.airspace.cls) || t === 'TMZ' || t === 'RMZ' || t === 'ATZ' || t === 'MATZ' || t === 'CTR') return 'warn';
  return 'info';
}
