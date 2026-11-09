import type { LatLon } from '../nav/geo';

type Ring = GeoJSON.Position[];

/** Ray-casting point-in-ring test (lon/lat treated as planar — fine at airspace scale). */
export function pointInRing(p: LatLon, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > p.lat !== yj > p.lat && p.lon < ((xj - xi) * (p.lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Polygon with holes: inside outer ring and outside all holes. */
export function pointInPolygon(p: LatLon, rings: Ring[]): boolean {
  if (!rings.length || !pointInRing(p, rings[0])) return false;
  for (let k = 1; k < rings.length; k++) if (pointInRing(p, rings[k])) return false;
  return true;
}

export function pointInGeometry(p: LatLon, g: GeoJSON.Polygon | GeoJSON.MultiPolygon): boolean {
  if (g.type === 'Polygon') return pointInPolygon(p, g.coordinates);
  return g.coordinates.some((poly) => pointInPolygon(p, poly));
}
