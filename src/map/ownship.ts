import type * as maplibregl from 'maplibre-gl';
import type { Fix } from '../inflight/navigation';
import type { Theme } from '../store/settings';

const SRC_OWN = 'own-ship';
const SRC_TRAIL = 'own-trail';
const empty = (): GeoJSON.FeatureCollection => ({ type: 'FeatureCollection', features: [] });

export function addOwnshipLayers(map: maplibregl.Map, theme: Theme) {
  if (map.getSource(SRC_OWN)) return;
  map.addSource(SRC_TRAIL, { type: 'geojson', data: empty() });
  map.addSource(SRC_OWN, { type: 'geojson', data: empty() });
  map.addLayer({
    id: 'own-trail', type: 'line', source: SRC_TRAIL,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': theme === 'dark' ? '#ffd43b' : '#1c1c1c', 'line-width': 2.5, 'line-dasharray': [1, 1.5], 'line-opacity': 0.8 },
  });
  map.addLayer({
    id: 'own-ship', type: 'symbol', source: SRC_OWN,
    layout: {
      'icon-image': 'ownship',
      'icon-size': 1.25,
      'icon-rotate': ['get', 'trk'],
      'icon-rotation-alignment': 'map',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
  });
}

export function updateOwnship(map: maplibregl.Map, fix: Fix | null, trail: [number, number][]) {
  const own = map.getSource(SRC_OWN) as maplibregl.GeoJSONSource | undefined;
  const tr = map.getSource(SRC_TRAIL) as maplibregl.GeoJSONSource | undefined;
  if (!own || !tr) return;
  own.setData(fix ? {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', properties: { trk: fix.trackTrue ?? 0 }, geometry: { type: 'Point', coordinates: [fix.lon, fix.lat] } }],
  } : empty());
  tr.setData(trail.length > 1 ? {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: trail } }],
  } : empty());
}
