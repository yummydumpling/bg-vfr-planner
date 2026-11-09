/** MapLibre sources & layers for aeronautical data. */
import type * as maplibregl from 'maplibre-gl';
import type { AeroData } from '../data/source';
import type { LayerKey, Theme } from '../store/settings';
import { addIcons } from './icons';
import { prepareAirports, prepareAirspaces, prepareNavaids, prepareReportingPoints, type ColorKey } from './prepare';

export const BASE_STYLES: Record<Theme, string> = {
  light: 'https://tiles.openfreemap.org/styles/liberty',
  dark: 'https://tiles.openfreemap.org/styles/dark',
};

const OPENAIP_ATTRIBUTION =
  '<a href="https://www.openaip.net" target="_blank" rel="noopener">© openAIP</a> (CC BY-NC 4.0)';

const PALETTE: Record<Theme, Record<ColorKey, string>> = {
  light: {
    ctr: '#c2255c', tma: '#1864ab', atz: '#9c36b5', prohibited: '#c92a2a', restricted: '#e03131',
    danger: '#e8590c', tra: '#d9480f', zone: '#495057', glide: '#2b8a3e', fir: '#343a40', other: '#868e96',
  },
  dark: {
    ctr: '#ff6b9a', tma: '#74c0fc', atz: '#da77f2', prohibited: '#ff6b6b', restricted: '#ff8787',
    danger: '#ffa94d', tra: '#ffc078', zone: '#ced4da', glide: '#8ce99a', fir: '#dee2e6', other: '#adb5bd',
  },
};

const FILL_OPACITY: Partial<Record<ColorKey, number>> = {
  ctr: 0.16, prohibited: 0.22, restricted: 0.12, danger: 0.05, tra: 0.06, atz: 0.12, tma: 0.05, zone: 0.05, glide: 0.06,
};

const TEXT: Record<Theme, { color: string; halo: string }> = {
  light: { color: '#1a1d21', halo: 'rgba(255,255,255,0.95)' },
  dark: { color: '#e9ecef', halo: 'rgba(11,15,20,0.95)' },
};

const FONT = ['Noto Sans Regular'];
const FONT_BOLD = ['Noto Sans Bold'];

function colorExpr(theme: Theme): maplibregl.ExpressionSpecification {
  const p = PALETTE[theme];
  const pairs = Object.entries(p).flatMap(([k, v]) => [k, v]);
  return ['match', ['get', 'ck'], ...pairs, p.other] as unknown as maplibregl.ExpressionSpecification;
}

function fillOpacityExpr(): maplibregl.ExpressionSpecification {
  const pairs = Object.entries(FILL_OPACITY).flatMap(([k, v]) => [k, v]);
  return ['match', ['get', 'ck'], ...pairs, 0] as unknown as maplibregl.ExpressionSpecification;
}

const AIRSPACE_CATS: LayerKey[] = ['controlled', 'atz', 'restricted', 'zones', 'fir', 'other'];

type Expr = maplibregl.ExpressionSpecification;

function catFilter(layers: Record<LayerKey, boolean>): Expr {
  const visible = AIRSPACE_CATS.filter((k) => layers[k]);
  return ['in', ['get', 'cat'], ['literal', visible]];
}

const all = (...parts: Expr[]): maplibregl.FilterSpecification => ['all', ...parts];
const NOT_FIR: Expr = ['!=', ['get', 'cat'], 'fir'];
const IS_SOLID: Expr = ['to-boolean', ['get', 'solid']];
const NOT_SOLID: Expr = ['!', ['to-boolean', ['get', 'solid']]];
const IS_LABELLED: Expr = ['to-boolean', ['get', 'labelled']];

export const LAYER_IDS = {
  asFill: 'aero-as-fill',
  asLineSolid: 'aero-as-line-solid',
  asLineDash: 'aero-as-line-dash',
  asLabel: 'aero-as-label',
  asHighlight: 'aero-as-highlight',
  airports: 'aero-airports',
  reporting: 'aero-reporting',
  navaids: 'aero-navaids',
} as const;

/** First symbol layer of the base style, so airspace fills sit under place names. */
function firstSymbolLayer(map: maplibregl.Map): string | undefined {
  return map.getStyle().layers?.find((l) => l.type === 'symbol')?.id;
}

export function addAeroLayers(
  map: maplibregl.Map,
  data: AeroData,
  theme: Theme,
  layers: Record<LayerKey, boolean>,
) {
  if (map.getSource('aero-airspaces')) return;
  addIcons(map, theme);
  const text = TEXT[theme];
  const color = colorExpr(theme);
  const fetched = data.meta.fetchedAt.slice(0, 10);

  map.addSource('aero-airspaces', {
    type: 'geojson',
    data: prepareAirspaces(data.airspaces),
    attribution: `${OPENAIP_ATTRIBUTION}, ${fetched}`,
  });
  map.addSource('aero-airports', { type: 'geojson', data: prepareAirports(data.airports) });
  map.addSource('aero-reporting', { type: 'geojson', data: prepareReportingPoints(data.reportingPoints) });
  map.addSource('aero-navaids', { type: 'geojson', data: prepareNavaids(data.navaids) });

  const below = firstSymbolLayer(map);
  const filter = catFilter(layers);

  map.addLayer({
    id: LAYER_IDS.asFill,
    type: 'fill',
    source: 'aero-airspaces',
    filter: all(filter, NOT_FIR),
    paint: { 'fill-color': color, 'fill-opacity': fillOpacityExpr() },
  }, below);

  map.addLayer({
    id: LAYER_IDS.asLineDash,
    type: 'line',
    source: 'aero-airspaces',
    filter: all(filter, NOT_SOLID),
    paint: {
      'line-color': color,
      'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1, 10, 2],
      'line-dasharray': [3, 2],
      'line-opacity': 0.9,
    },
  });
  map.addLayer({
    id: LAYER_IDS.asLineSolid,
    type: 'line',
    source: 'aero-airspaces',
    filter: all(filter, IS_SOLID),
    paint: {
      'line-color': color,
      'line-width': ['interpolate', ['linear'], ['zoom'], 6, ['match', ['get', 'ck'], 'fir', 1.5, 1.2], 10, ['match', ['get', 'ck'], 'fir', 3, 2.5]],
      'line-opacity': 0.95,
    },
  });
  map.addLayer({
    id: LAYER_IDS.asHighlight,
    type: 'line',
    source: 'aero-airspaces',
    filter: ['in', ['get', 'id'], ['literal', []]],
    paint: { 'line-color': theme === 'dark' ? '#ffe066' : '#f08c00', 'line-width': 4, 'line-opacity': 0.9 },
  });
  map.addLayer({
    id: LAYER_IDS.asLabel,
    type: 'symbol',
    source: 'aero-airspaces',
    minzoom: 8,
    filter: all(filter, IS_LABELLED),
    layout: {
      'symbol-placement': 'line',
      'symbol-spacing': 350,
      'text-field': ['concat', ['get', 'name'], '  ', ['get', 'lowerTxt'], ' – ', ['get', 'upperTxt']],
      'text-font': FONT,
      'text-size': 10.5,
      'text-offset': [0, 0.9],
      'text-max-angle': 30,
    },
    paint: { 'text-color': color, 'text-halo-color': text.halo, 'text-halo-width': 1.4 },
  });

  map.addLayer({
    id: LAYER_IDS.navaids,
    type: 'symbol',
    source: 'aero-navaids',
    minzoom: 6,
    layout: {
      'icon-image': ['get', 'icon'],
      'icon-allow-overlap': true,
      'text-field': ['step', ['zoom'], '', 8, ['get', 'label']],
      'text-font': FONT,
      'text-size': 11,
      'text-anchor': 'left',
      'text-offset': [1.1, 0],
      'text-optional': true,
      visibility: layers.navaids ? 'visible' : 'none',
    },
    paint: { 'text-color': text.color, 'text-halo-color': text.halo, 'text-halo-width': 1.4 },
  });
  map.addLayer({
    id: LAYER_IDS.reporting,
    type: 'symbol',
    source: 'aero-reporting',
    minzoom: 7,
    layout: {
      'icon-image': ['get', 'icon'],
      'icon-size': 0.85,
      'icon-allow-overlap': true,
      'text-field': ['step', ['zoom'], '', 8.5, ['get', 'name']],
      'text-font': FONT,
      'text-size': 11,
      'text-anchor': 'top',
      'text-offset': [0, 0.8],
      'text-optional': true,
      visibility: layers.reporting ? 'visible' : 'none',
    },
    paint: { 'text-color': text.color, 'text-halo-color': text.halo, 'text-halo-width': 1.4 },
  });
  map.addLayer({
    id: LAYER_IDS.airports,
    type: 'symbol',
    source: 'aero-airports',
    // minor strips only from zoom 7.5 to keep the country view readable
    filter: ['any', ['<=', ['get', 'rank'], 2], ['>=', ['zoom'], 7.5]],
    layout: {
      'icon-image': ['get', 'icon'],
      'icon-rotate': ['get', 'rot'],
      'icon-rotation-alignment': 'map',
      'icon-allow-overlap': true,
      'icon-size': ['interpolate', ['linear'], ['zoom'], 5.5, 0.5, 8, 0.8, 11, 1.05],
      'symbol-sort-key': ['get', 'rank'],
      'text-field': [
        'step', ['zoom'],
        ['case', ['<=', ['get', 'rank'], 1], ['get', 'label'], ''],
        7.5, ['get', 'label'],
        10, ['concat', ['get', 'label'], '\n', ['get', 'name']],
      ],
      'text-font': FONT_BOLD,
      'text-size': 11.5,
      'text-anchor': 'top',
      'text-offset': [0, 1.1],
      'text-optional': true,
      visibility: layers.airports ? 'visible' : 'none',
    },
    paint: { 'text-color': text.color, 'text-halo-color': text.halo, 'text-halo-width': 1.6 },
  });
}

export function updateLayerVisibility(map: maplibregl.Map, layers: Record<LayerKey, boolean>) {
  if (!map.getLayer(LAYER_IDS.asFill)) return;
  const filter = catFilter(layers);
  map.setFilter(LAYER_IDS.asFill, all(filter, NOT_FIR));
  map.setFilter(LAYER_IDS.asLineDash, all(filter, NOT_SOLID));
  map.setFilter(LAYER_IDS.asLineSolid, all(filter, IS_SOLID));
  map.setFilter(LAYER_IDS.asLabel, all(filter, IS_LABELLED));
  const vis = (on: boolean) => (on ? 'visible' : 'none');
  map.setLayoutProperty(LAYER_IDS.airports, 'visibility', vis(layers.airports));
  map.setLayoutProperty(LAYER_IDS.reporting, 'visibility', vis(layers.reporting));
  map.setLayoutProperty(LAYER_IDS.navaids, 'visibility', vis(layers.navaids));
}

export function setHighlightedAirspaces(map: maplibregl.Map, ids: string[]) {
  if (!map.getLayer(LAYER_IDS.asHighlight)) return;
  map.setFilter(LAYER_IDS.asHighlight, ['in', ['get', 'id'], ['literal', ids]]);
}
