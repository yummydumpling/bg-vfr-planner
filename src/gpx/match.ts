import type { Waypoint } from '../domain/types';
import type { AeroData } from '../data/source';
import { distanceNm } from '../nav/geo';
import { makeWaypoint } from '../route/ops';
import { formatItem15Coord } from '../nav/coords';
import type { GpxPoint } from './gpx';

/** Same name within this distance → it's that aerodrome/point/navaid. */
const NAME_MATCH_NM = 2;
/** Unnamed/other-named point this close to a known object → snap to it. */
const POSITION_MATCH_NM = 0.15;

/**
 * Turn imported GPX points into waypoints, recognising aerodromes, reporting
 * points and navaids by name (ICAO / name / ident) and position, so the
 * flight plan can use their designators.
 */
export function gpxToWaypoints(points: GpxPoint[], data: AeroData | null): Waypoint[] {
  return points.map((p) => {
    const name = p.name.trim().toUpperCase();
    if (data) {
      const cands: Omit<Waypoint, 'id'>[] = [
        ...data.airports.map((a) => ({ lat: a.lat, lon: a.lon, name: a.icao ?? a.name, kind: 'airport' as const, refId: a.id })),
        ...data.reportingPoints.map((r) => ({ lat: r.lat, lon: r.lon, name: r.name, kind: 'reporting' as const, refId: r.id })),
        ...data.navaids.map((n) => ({ lat: n.lat, lon: n.lon, name: n.ident, kind: 'navaid' as const, refId: n.id })),
      ];
      const byName = cands.find((c) => c.name.toUpperCase() === name && distanceNm(c, p) <= NAME_MATCH_NM);
      if (byName) return makeWaypoint(byName);
      let best: (typeof cands)[number] | null = null;
      let bestD = POSITION_MATCH_NM;
      for (const c of cands) {
        const d = distanceNm(c, p);
        if (d <= bestD) { best = c; bestD = d; }
      }
      if (best) return makeWaypoint(best);
    }
    return makeWaypoint({ lat: p.lat, lon: p.lon, kind: 'user', name: p.name.trim() || formatItem15Coord(p.lat, p.lon) });
  });
}
