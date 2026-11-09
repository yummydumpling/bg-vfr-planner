/**
 * Draggable DOM markers for route editing:
 *  - one numbered marker per waypoint (drag to move, tap to select)
 *  - a "+" handle at each leg midpoint (tap to insert, drag to insert & place)
 * Markers report drags through callbacks; the route store is only updated on
 * drag end, while the line is previewed live.
 */
import * as maplibregl from 'maplibre-gl';
import type { Waypoint } from '../domain/types';
import { midpoint } from '../nav/geo';

export interface RouteMarkerCallbacks {
  /** Live preview while dragging a waypoint or an insert handle. */
  onPreview: (wps: Waypoint[]) => void;
  onMoveEnd: (id: string, at: maplibregl.LngLat) => void;
  onInsertEnd: (index: number, at: maplibregl.LngLat) => void;
  onTapWaypoint: (id: string) => void;
}

/** `el` is MapLibre's marker wrapper (keeps its own classes); `inner` carries our styling. */
interface WpEntry { marker: maplibregl.Marker; el: HTMLDivElement; inner: HTMLDivElement }

export class RouteMarkers {
  private wpMarkers = new Map<string, WpEntry>();
  private handles: maplibregl.Marker[] = [];
  private wps: Waypoint[] = [];
  private editable = false;
  private dragging = false;
  private readonly map: maplibregl.Map;
  private readonly cb: RouteMarkerCallbacks;

  constructor(map: maplibregl.Map, cb: RouteMarkerCallbacks) {
    this.map = map;
    this.cb = cb;
  }

  get isDragging() {
    return this.dragging;
  }

  sync(wps: Waypoint[], editable: boolean, selectedId: string | null) {
    if (this.dragging) return; // never rebuild under the user's finger
    this.wps = wps;
    this.editable = editable;
    const seen = new Set<string>();

    wps.forEach((w, i) => {
      seen.add(w.id);
      let entry = this.wpMarkers.get(w.id);
      if (!entry) entry = this.createWaypointMarker(w.id);
      entry.marker.setLngLat([w.lon, w.lat]);
      entry.marker.setDraggable(editable);
      const role = i === 0 ? ' wp-first' : i === wps.length - 1 ? ' wp-last' : '';
      entry.inner.className = `wp-marker${role}${w.kind === 'user' ? ' wp-user' : ''}${w.id === selectedId ? ' wp-selected' : ''}`;
      entry.inner.textContent = String(i + 1);
      entry.el.title = w.name;
      entry.el.setAttribute('aria-label', `${i + 1}: ${w.name}`);
    });
    for (const [id, entry] of this.wpMarkers) {
      if (!seen.has(id)) {
        entry.marker.remove();
        this.wpMarkers.delete(id);
      }
    }

    this.handles.forEach((h) => h.remove());
    this.handles = [];
    if (!editable) return;
    for (let i = 0; i < wps.length - 1; i++) this.handles.push(this.createHandle(i));
  }

  destroy() {
    this.wpMarkers.forEach((e) => e.marker.remove());
    this.handles.forEach((h) => h.remove());
    this.wpMarkers.clear();
    this.handles = [];
  }

  private createWaypointMarker(id: string): WpEntry {
    const el = document.createElement('div');
    const inner = document.createElement('div');
    el.appendChild(inner);
    el.setAttribute('role', 'button');
    const marker = new maplibregl.Marker({ element: el, draggable: this.editable }).setLngLat([0, 0]).addTo(this.map);
    let moved = false;
    marker.on('dragstart', () => {
      this.dragging = true;
      moved = true;
    });
    marker.on('drag', () => {
      const p = marker.getLngLat();
      this.cb.onPreview(this.wps.map((w) => (w.id === id ? { ...w, lat: p.lat, lon: p.lng } : w)));
    });
    marker.on('dragend', () => {
      this.dragging = false;
      this.cb.onMoveEnd(id, marker.getLngLat());
      // swallow the click that some browsers fire right after a drag
      setTimeout(() => (moved = false), 50);
    });
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!moved) this.cb.onTapWaypoint(id);
    });
    const entry = { marker, el, inner };
    this.wpMarkers.set(id, entry);
    return entry;
  }

  private createHandle(legIndex: number): maplibregl.Marker {
    const a = this.wps[legIndex];
    const b = this.wps[legIndex + 1];
    const m = midpoint(a, b);
    const el = document.createElement('div');
    el.className = 'leg-handle';
    el.textContent = '+';
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', 'Insert waypoint');
    const marker = new maplibregl.Marker({ element: el, draggable: true }).setLngLat([m.lon, m.lat]).addTo(this.map);
    let moved = false;
    const preview = () => {
      const p = marker.getLngLat();
      const temp: Waypoint = { id: '__insert__', lat: p.lat, lon: p.lng, name: '', kind: 'user' };
      this.cb.onPreview([...this.wps.slice(0, legIndex + 1), temp, ...this.wps.slice(legIndex + 1)]);
    };
    marker.on('dragstart', () => {
      this.dragging = true;
      moved = true;
      el.classList.add('leg-handle-active');
    });
    marker.on('drag', preview);
    marker.on('dragend', () => {
      this.dragging = false;
      this.cb.onInsertEnd(legIndex + 1, marker.getLngLat());
      setTimeout(() => (moved = false), 50);
    });
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!moved) this.cb.onInsertEnd(legIndex + 1, marker.getLngLat());
    });
    return marker;
  }
}
