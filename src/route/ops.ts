/**
 * Pure route-editing operations. They never mutate their input, which makes
 * undo trivial (keep the previous array) and keeps them easy to test.
 */
import type { Waypoint } from '../domain/types';
import { formatItem15Coord } from '../nav/coords';
import type { LatLon } from '../nav/geo';
import { newId } from './id';

export type WaypointInput = Omit<Waypoint, 'id'> & { id?: string };

export function makeWaypoint(input: WaypointInput): Waypoint {
  return { ...input, id: input.id ?? newId() };
}

/** A free (unsnapped) user point named by its ICAO-style coordinates. */
export function userWaypoint(p: LatLon): Waypoint {
  return makeWaypoint({ lat: p.lat, lon: p.lon, kind: 'user', name: formatItem15Coord(p.lat, p.lon) });
}

const clampIndex = (i: number, len: number) => Math.max(0, Math.min(len, i));

/** Append, or insert before `index` (0 = new departure). */
export function addWaypoint(list: Waypoint[], wp: Waypoint, index = list.length): Waypoint[] {
  const i = clampIndex(index, list.length);
  return [...list.slice(0, i), wp, ...list.slice(i)];
}

export function removeWaypoint(list: Waypoint[], id: string): Waypoint[] {
  return list.filter((w) => w.id !== id);
}

/**
 * Move a waypoint. If `snapped` is given the waypoint takes over its identity
 * (name, kind, refId); otherwise it becomes a user point named by coordinates.
 */
export function moveWaypoint(list: Waypoint[], id: string, to: LatLon, snapped?: Omit<Waypoint, 'id'>): Waypoint[] {
  return list.map((w) => {
    if (w.id !== id) return w;
    if (snapped) return { ...snapped, id };
    return { id, lat: to.lat, lon: to.lon, kind: 'user', name: formatItem15Coord(to.lat, to.lon) };
  });
}

export function reverseRoute(list: Waypoint[]): Waypoint[] {
  return [...list].reverse();
}

/** Move a waypoint from one position in the list to another (reorder). */
export function reorderWaypoint(list: Waypoint[], from: number, to: number): Waypoint[] {
  if (from < 0 || from >= list.length) return list;
  const out = [...list];
  const [w] = out.splice(from, 1);
  out.splice(clampIndex(to, out.length), 0, w);
  return out;
}

export function renameWaypoint(list: Waypoint[], id: string, name: string): Waypoint[] {
  const trimmed = name.trim();
  if (!trimmed) return list;
  return list.map((w) => (w.id === id ? { ...w, name: trimmed } : w));
}
