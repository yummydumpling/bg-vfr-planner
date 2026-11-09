import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// Bundle MapLibre's web worker (and its imports) as a separate Vite entry.
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { useEffect, useRef } from 'react';
import { airspacesAt } from '../airspace/query';
import { useData } from '../store/data';
import { useSettings, type LayerKey } from '../store/settings';
import { BASE_STYLES, LAYER_IDS, addAeroLayers, setHighlightedAirspaces, updateLayerVisibility } from './layers';

/** Bulgaria with a little margin [W, S, E, N]. */
const BG_BOUNDS: [number, number, number, number] = [22.3, 41.2, 28.7, 44.25];
const TAP_TOLERANCE_PX = 12;

maplibregl.setWorkerUrl(maplibreWorkerUrl);

export function MapView() {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const theme = useSettings((s) => s.theme);
  const layers = useSettings((s) => s.layers);
  const data = useData((s) => s.data);
  const selection = useData((s) => s.selection);

  // Latest values for map event handlers
  const live = useRef({ theme, layers, data });
  live.current = { theme, layers, data };

  // Create the map once
  useEffect(() => {
    if (!container.current) return;
    const map = new maplibregl.Map({
      container: container.current,
      style: BASE_STYLES[live.current.theme],
      bounds: BG_BOUNDS,
      fitBoundsOptions: { padding: 10 },
      attributionControl: { compact: true },
      dragRotate: false,
      maxPitch: 0,
    });
    map.touchZoomRotate.disableRotation();
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(
      new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true }),
      'top-right',
    );
    map.addControl(new maplibregl.ScaleControl({ unit: 'nautical' }), 'bottom-left');

    const addOverlays = () => {
      const { data: d, theme: t, layers: l } = live.current;
      if (!d) return;
      addAeroLayers(map, d, t, l);
      const sel = useData.getState().selection;
      setHighlightedAirspaces(map, sel?.kind === 'airspaces' ? sel.ids : []);
    };
    map.on('style.load', addOverlays);
    // Start with the attribution collapsed on small screens (still one tap away).
    map.once('load', () => {
      if (window.innerWidth < 760) container.current?.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
    });

    const interactive = [LAYER_IDS.airports, LAYER_IDS.reporting, LAYER_IDS.navaids];
    map.on('click', (e) => {
      const { data: d, layers: l } = live.current;
      if (!d) return;
      const present = interactive.filter((id) => map.getLayer(id));
      const { x, y } = e.point;
      const hits = map.queryRenderedFeatures(
        [[x - TAP_TOLERANCE_PX, y - TAP_TOLERANCE_PX], [x + TAP_TOLERANCE_PX, y + TAP_TOLERANCE_PX]],
        { layers: present },
      );
      if (hits.length) {
        // nearest symbol to the tap
        const nearest = hits
          .map((f) => {
            const [lon, lat] = (f.geometry as GeoJSON.Point).coordinates;
            const p = map.project([lon, lat]);
            return { f, d2: (p.x - x) ** 2 + (p.y - y) ** 2 };
          })
          .sort((a, b) => a.d2 - b.d2)[0].f;
        const id = String(nearest.properties?.id);
        const kind = nearest.layer.id === LAYER_IDS.airports ? 'airport' : nearest.layer.id === LAYER_IDS.reporting ? 'reporting' : 'navaid';
        useData.getState().select({ kind, id });
        return;
      }
      const { lat, lng } = e.lngLat;
      const found = airspacesAt(d.airspaces, { lat, lon: lng }, (cat) => l[cat as LayerKey]);
      useData.getState().select({ kind: 'airspaces', lat, lon: lng, ids: found.map((a) => a.id) });
    });

    for (const id of interactive) {
      map.on('mouseenter', id, () => (map.getCanvas().style.cursor = 'pointer'));
      map.on('mouseleave', id, () => (map.getCanvas().style.cursor = ''));
    }

    mapRef.current = map;
    // Dev-only hook for automated UI checks
    if (import.meta.env.DEV) (window as unknown as { __bgvfrMap?: maplibregl.Map }).__bgvfrMap = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Data arrived after the style loaded
  useEffect(() => {
    const map = mapRef.current;
    if (map && data && map.isStyleLoaded()) addAeroLayers(map, data, theme, layers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // Theme → swap base style (overlays are re-added on style.load)
  const firstTheme = useRef(theme);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || theme === firstTheme.current) return;
    firstTheme.current = theme;
    map.setStyle(BASE_STYLES[theme], { diff: false });
  }, [theme]);

  useEffect(() => {
    if (mapRef.current) updateLayerVisibility(mapRef.current, layers);
  }, [layers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    setHighlightedAirspaces(map, selection?.kind === 'airspaces' ? selection.ids : []);
  }, [selection, theme]);

  return <div ref={container} className="map" role="application" aria-label="Map" />;
}
