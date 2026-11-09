import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// Bundle MapLibre's web worker (and its imports) as a separate Vite entry.
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { useEffect, useRef } from 'react';
import { airspacesAt } from '../airspace/query';
import type { Waypoint } from '../domain/types';
import { waypointFromFeature, type PointKind } from '../route/fromData';
import { makeWaypoint, userWaypoint } from '../route/ops';
import { useData } from '../store/data';
import { useRoute } from '../store/route';
import { useSettings, type LayerKey } from '../store/settings';
import { BASE_STYLES, LAYER_IDS, addAeroLayers, setHighlightedAirspaces, updateLayerVisibility } from './layers';
import { revealPoint } from './focus';
import { setMapInstance } from './mapInstance';
import { addRouteLayers, updateRouteLayers } from './routeLayer';
import { addOwnshipLayers, updateOwnship } from './ownship';
import { useInflight } from '../store/inflight';
import { RouteMarkers } from './routeMarkers';

/** Bulgaria with a little margin [W, S, E, N]. */
const BG_BOUNDS: [number, number, number, number] = [22.3, 41.2, 28.7, 44.25];
/** Finger-friendly hit radius for symbols and snapping. */
const TAP_TOLERANCE_PX = 14;

maplibregl.setWorkerUrl(maplibreWorkerUrl);

const INTERACTIVE = [LAYER_IDS.airports, LAYER_IDS.reporting, LAYER_IDS.navaids];
const KIND_BY_LAYER: Record<string, PointKind> = {
  [LAYER_IDS.airports]: 'airport',
  [LAYER_IDS.reporting]: 'reporting',
  [LAYER_IDS.navaids]: 'navaid',
};

/** Nearest aerodrome / reporting point / navaid symbol to a screen point. */
function featureAt(map: maplibregl.Map, point: maplibregl.Point): { kind: PointKind; id: string } | null {
  const layers = INTERACTIVE.filter((id) => map.getLayer(id));
  if (!layers.length) return null;
  const t = TAP_TOLERANCE_PX;
  const hits = map.queryRenderedFeatures([[point.x - t, point.y - t], [point.x + t, point.y + t]], { layers });
  if (!hits.length) return null;
  const nearest = hits
    .map((f) => {
      const [lon, lat] = (f.geometry as GeoJSON.Point).coordinates;
      const p = map.project([lon, lat]);
      return { f, d2: (p.x - point.x) ** 2 + (p.y - point.y) ** 2 };
    })
    .sort((a, b) => a.d2 - b.d2)[0].f;
  return { kind: KIND_BY_LAYER[nearest.layer.id], id: String(nearest.properties?.id) };
}

function highlightFor(sel: ReturnType<typeof useData.getState>['selection']) {
  return sel?.kind === 'airspaces' ? { ids: sel.ids, focusId: sel.focusId, point: { lat: sel.lat, lon: sel.lon } } : null;
}

export function MapView() {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<RouteMarkers | null>(null);
  /**
   * True once the current base style has fired `style.load`. We can't use
   * map.isStyleLoaded(): it stays false while base-map tiles are still
   * downloading, so data arriving in that window was never drawn.
   */
  const styleReady = useRef(false);
  const addOverlaysRef = useRef<() => void>(() => undefined);
  const theme = useSettings((s) => s.theme);
  const layers = useSettings((s) => s.layers);
  const data = useData((s) => s.data);
  const selection = useData((s) => s.selection);
  const waypoints = useRoute((s) => s.route.waypoints);
  const planning = useRoute((s) => s.planning);
  const selectedWp = useRoute((s) => s.selectedWp);

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

    /** Snap a screen point to a nearby aerodrome/point, if any. */
    const snapAt = (point: maplibregl.Point): Omit<Waypoint, 'id'> | null => {
      const d = live.current.data;
      const hit = d && featureAt(map, point);
      return hit && d ? waypointFromFeature(d, hit.kind, hit.id) : null;
    };

    const markers = new RouteMarkers(map, {
      onPreview: (wps) => updateRouteLayers(map, wps),
      onMoveEnd: (id, at) => {
        const snapped = snapAt(map.project(at));
        useRoute.getState().move(id, { lat: at.lat, lon: at.lng }, snapped ?? undefined);
      },
      onInsertEnd: (index, at) => {
        const snapped = snapAt(map.project(at));
        const wp = snapped ? makeWaypoint(snapped) : userWaypoint({ lat: at.lat, lon: at.lng });
        useRoute.getState().add(wp, index);
        useRoute.getState().selectWp(wp.id);
      },
      onTapWaypoint: (id) => {
        // While planning, tapping an earlier waypoint (e.g. the departure aerodrome
        // under marker 1) routes back to it; tapping the last one just selects it.
        const r = useRoute.getState();
        const wps = r.route.waypoints;
        if (r.planning && wps.length > 1 && wps[wps.length - 1].id !== id) {
          r.appendCopy(id);
          const after = useRoute.getState().route.waypoints;
          r.selectWp(after[after.length - 1].id);
        } else {
          r.selectWp(id);
        }
      },
    });
    markersRef.current = markers;

    const addOverlays = () => {
      const { data: d, theme: t, layers: l } = live.current;
      if (!d) return;
      addAeroLayers(map, d, t, l);
      addRouteLayers(map, t);
      updateRouteLayers(map, useRoute.getState().route.waypoints);
      addOwnshipLayers(map, t);
      const inf = useInflight.getState();
      if (inf.active) updateOwnship(map, inf.fix, inf.trail);
      setHighlightedAirspaces(map, highlightFor(useData.getState().selection));
    };
    addOverlaysRef.current = addOverlays;
    map.on('style.load', () => {
      styleReady.current = true;
      addOverlays();
    });
    // Start with the attribution collapsed on small screens (still one tap away).
    map.once('load', () => {
      if (window.innerWidth < 760) container.current?.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
    });

    map.on('click', (e) => {
      const { data: d, layers: l } = live.current;
      if (!d || markers.isDragging) return;
      // Taps on route markers/handles are handled by the markers themselves
      if ((e.originalEvent.target as HTMLElement | null)?.closest?.('.maplibregl-marker')) return;

      const route = useRoute.getState();
      if (route.planning) {
        const snapped = snapAt(e.point);
        const wp = snapped ? makeWaypoint(snapped) : userWaypoint({ lat: e.lngLat.lat, lon: e.lngLat.lng });
        route.add(wp);
        route.selectWp(wp.id);
        return;
      }

      const hit = featureAt(map, e.point);
      if (hit) {
        useData.getState().select(hit);
        return;
      }
      const { lat, lng } = e.lngLat;
      const found = airspacesAt(d.airspaces, { lat, lon: lng }, (cat) => l[cat as LayerKey]);
      useData.getState().select({ kind: 'airspaces', lat, lon: lng, ids: found.map((a) => a.id), focusId: found[0]?.id });
      revealPoint(lat, lng);
    });

    // Panning by hand while flying stops "follow aircraft".
    map.on('dragstart', () => {
      if (useInflight.getState().active) useInflight.getState().setFollow(false);
    });

    for (const id of INTERACTIVE) {
      map.on('mouseenter', id, () => (map.getCanvas().style.cursor = 'pointer'));
      map.on('mouseleave', id, () => (map.getCanvas().style.cursor = ''));
    }

    mapRef.current = map;
    setMapInstance(map);
    // Dev-only hook for automated UI checks
    if (import.meta.env.DEV) (window as unknown as { __bgvfrMap?: maplibregl.Map }).__bgvfrMap = map;
    return () => {
      markers.destroy();
      markersRef.current = null;
      setMapInstance(null);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // In-flight: own-ship symbol, flown track and follow camera
  useEffect(
    () =>
      useInflight.subscribe((s, prev) => {
        const map = mapRef.current;
        if (!map) return;
        if (!s.active) {
          if (prev.active) updateOwnship(map, null, []);
          return;
        }
        if (s.fix === prev.fix && s.follow === prev.follow) return;
        updateOwnship(map, s.fix, s.trail);
        if (s.follow && s.fix) {
          // Centre the aircraft in the part of the map not covered by the instrument strip/bottom bar.
          const top = (document.querySelector('.if-top') as HTMLElement | null)?.offsetHeight ?? 0;
          const bottom = (document.querySelector('.if-bottom') as HTMLElement | null)?.offsetHeight ?? 0;
          const zoomIn = !prev.fix || s.follow !== prev.follow;
          map.easeTo({
            center: [s.fix.lon, s.fix.lat],
            offset: [0, (top - bottom) / 2],
            zoom: zoomIn ? Math.max(map.getZoom(), 9.5) : map.getZoom(),
            duration: zoomIn ? 600 : 900,
            essential: true,
          });
        }
      }),
    [],
  );

  // Data arrived after the style loaded (overlay adding is idempotent)
  useEffect(() => {
    if (data && styleReady.current) addOverlaysRef.current();
  }, [data]);

  // Route changed → redraw line and markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    updateRouteLayers(map, waypoints);
    markersRef.current?.sync(waypoints, planning, selectedWp);
  }, [waypoints, planning, selectedWp]);

  // While planning: crosshair cursor, and no double-tap zoom — two quick taps
  // must add two waypoints, not zoom the map.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getCanvas().style.cursor = planning ? 'crosshair' : '';
    if (planning) map.doubleClickZoom.disable();
    else map.doubleClickZoom.enable();
  }, [planning]);

  // Theme → swap base style (overlays are re-added on style.load)
  const firstTheme = useRef(theme);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || theme === firstTheme.current) return;
    firstTheme.current = theme;
    styleReady.current = false;
    map.setStyle(BASE_STYLES[theme], { diff: false });
  }, [theme]);

  useEffect(() => {
    if (mapRef.current) updateLayerVisibility(mapRef.current, layers);
  }, [layers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    setHighlightedAirspaces(map, highlightFor(selection));
  }, [selection, theme]);

  return <div ref={container} className={`map${planning ? ' map-planning' : ''}`} role="application" aria-label="Map" />;
}
