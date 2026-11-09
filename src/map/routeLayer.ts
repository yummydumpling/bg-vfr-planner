import type * as maplibregl from 'maplibre-gl';
import type { Waypoint } from '../domain/types';
import { densify } from '../nav/geo';
import { formatTrack, summarizeLegs } from '../route/legs';
import type { Theme } from '../store/settings';

const SRC_LINE = 'route-line';
const SRC_LABEL = 'route-labels';

export const ROUTE_COLOR: Record<Theme, string> = { light: '#d6009a', dark: '#ff5cd6' };

const empty = (): GeoJSON.FeatureCollection => ({ type: 'FeatureCollection', features: [] });

export function addRouteLayers(map: maplibregl.Map, theme: Theme) {
  if (map.getSource(SRC_LINE)) return;
  map.addSource(SRC_LINE, { type: 'geojson', data: empty() });
  map.addSource(SRC_LABEL, { type: 'geojson', data: empty() });
  const casing = theme === 'dark' ? '#0b0f14' : '#ffffff';
  map.addLayer({
    id: 'route-casing', type: 'line', source: SRC_LINE,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': casing, 'line-width': 8, 'line-opacity': 0.9 },
  });
  map.addLayer({
    id: 'route-line', type: 'line', source: SRC_LINE,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': ROUTE_COLOR[theme], 'line-width': 4 },
  });
  map.addLayer({
    id: 'route-label', type: 'symbol', source: SRC_LABEL,
    layout: {
      'text-field': ['get', 'label'],
      'text-font': ['Noto Sans Bold'],
      'text-size': 12,
      'text-offset': [0, -1.3],
      'text-allow-overlap': false,
      'text-optional': true,
    },
    paint: { 'text-color': ROUTE_COLOR[theme], 'text-halo-color': casing, 'text-halo-width': 2 },
  });
}

/** Redraw the route (also used for live previews while dragging). */
export function updateRouteLayers(map: maplibregl.Map, wps: Waypoint[]) {
  const line = map.getSource(SRC_LINE) as maplibregl.GeoJSONSource | undefined;
  const labels = map.getSource(SRC_LABEL) as maplibregl.GeoJSONSource | undefined;
  if (!line || !labels) return;
  const { legs } = summarizeLegs(wps);
  line.setData({
    type: 'FeatureCollection',
    features: legs.map((l) => ({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: densify(l.from, l.to, 2).map((p) => [p.lon, p.lat]) },
    })),
  });
  labels.setData({
    type: 'FeatureCollection',
    features: legs.map((l) => ({
      type: 'Feature',
      properties: { label: `${formatTrack(l.magTrack)}M  ${l.distanceNm.toFixed(1)} NM` },
      geometry: { type: 'Point', coordinates: [l.mid.lon, l.mid.lat] },
    })),
  });
}
