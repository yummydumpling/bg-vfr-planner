import type { Waypoint } from '../domain/types';
import type { AeroData } from '../data/source';

export type PointKind = 'airport' | 'reporting' | 'navaid';

/** Waypoint fields for an aerodrome / reporting point / navaid from the data set. */
export function waypointFromFeature(data: AeroData, kind: PointKind, id: string): Omit<Waypoint, 'id'> | null {
  if (kind === 'airport') {
    const a = data.airports.find((x) => x.id === id);
    return a ? { lat: a.lat, lon: a.lon, name: a.icao ?? a.name, kind, refId: a.id } : null;
  }
  if (kind === 'reporting') {
    const p = data.reportingPoints.find((x) => x.id === id);
    return p ? { lat: p.lat, lon: p.lon, name: p.name, kind, refId: p.id } : null;
  }
  const n = data.navaids.find((x) => x.id === id);
  return n ? { lat: n.lat, lon: n.lon, name: n.ident, kind, refId: n.id } : null;
}
