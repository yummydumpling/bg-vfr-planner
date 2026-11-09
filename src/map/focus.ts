/** Camera helpers that keep things visible above the bottom card on phones. */
import type { AirspaceCollection } from '../data/source';
import { getMapInstance } from './mapInstance';

const isPhone = () => window.innerWidth < 760;
/** Fraction of the map hidden by the bottom card on phones. */
const SHEET = 0.55;

/** Pan so a point sits in the middle of the visible area above the card. */
export function revealPoint(lat: number, lon: number) {
  const map = getMapInstance();
  if (!map || !isPhone()) return;
  const h = map.getContainer().clientHeight;
  const w = map.getContainer().clientWidth;
  const p = map.project([lon, lat]);
  const target = { x: w / 2, y: (h * (1 - SHEET)) / 2 };
  if (Math.abs(p.y - target.y) < 30 && Math.abs(p.x - target.x) < w * 0.3) return;
  map.panBy([p.x - target.x, p.y - target.y], { duration: 350 });
}

/** Zoom to one airspace so its whole shape is visible above the card. */
export function zoomToAirspace(fc: AirspaceCollection, id: string) {
  const map = getMapInstance();
  const f = fc.features.find((x) => x.properties.id === id);
  if (!map || !f) return;
  let [w, s, e, n] = [Infinity, Infinity, -Infinity, -Infinity];
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const poly of polys) for (const [x, y] of poly[0]) {
    w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y);
  }
  const h = map.getContainer().clientHeight;
  const cam = map.cameraForBounds([[w, s], [e, n]], {
    padding: { top: 30, left: 30, right: 50, bottom: isPhone() ? h * SHEET + 20 : 30 },
    maxZoom: 11,
  });
  if (cam) map.easeTo({ center: cam.center, zoom: cam.zoom, duration: 450 });
}
