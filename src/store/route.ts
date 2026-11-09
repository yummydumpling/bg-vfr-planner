import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Route, RouteWind, Waypoint } from '../domain/types';
import { newId } from '../route/id';
import * as ops from '../route/ops';
import { safeStorage } from './safeStorage';

const MAX_UNDO = 50;

interface RouteState {
  route: Route;
  /** Previous waypoint lists for undo (most recent last). Not persisted. */
  past: Waypoint[][];
  /** Tap-to-add mode. */
  planning: boolean;
  /** Waypoint highlighted on map and in the list. */
  selectedWp: string | null;
  setPlanning: (on: boolean) => void;
  selectWp: (id: string | null) => void;
  add: (wp: Waypoint, index?: number) => void;
  remove: (id: string) => void;
  /** Append a copy of an existing waypoint (round trips). */
  appendCopy: (id: string) => void;
  move: (id: string, to: { lat: number; lon: number }, snapped?: Omit<Waypoint, 'id'>) => void;
  reorder: (from: number, to: number) => void;
  rename: (id: string, name: string) => void;
  reverse: () => void;
  clear: () => void;
  undo: () => void;
  setWind: (w: RouteWind) => void;
  setCruiseAlt: (ft: number) => void;
  setAlternates: (a: string[]) => void;
}

export const DEFAULT_CRUISE_ALT_FT = 3500;

const emptyRoute = (): Route => ({
  id: newId(),
  name: '',
  waypoints: [],
  cruiseAltFt: DEFAULT_CRUISE_ALT_FT,
  wind: { fromDeg: 0, speedKt: 0 },
  alternates: [],
  updatedAt: new Date().toISOString(),
});

export const useRoute = create<RouteState>()(
  persist(
    (set, get) => {
      /** Apply an edit, recording the previous state for undo. */
      const edit = (fn: (list: Waypoint[]) => Waypoint[]) => {
        const { route, past } = get();
        const next = fn(route.waypoints);
        if (next === route.waypoints) return;
        set({
          route: { ...route, waypoints: next, updatedAt: new Date().toISOString() },
          past: [...past, route.waypoints].slice(-MAX_UNDO),
        });
      };
      return {
        route: emptyRoute(),
        past: [],
        planning: false,
        selectedWp: null,
        setPlanning: (planning) => set({ planning }),
        selectWp: (selectedWp) => set({ selectedWp }),
        add: (wp, index) => edit((l) => ops.addWaypoint(l, wp, index)),
        appendCopy: (id) => edit((l) => ops.appendCopyOf(l, id)),
        remove: (id) => edit((l) => ops.removeWaypoint(l, id)),
        move: (id, to, snapped) => edit((l) => ops.moveWaypoint(l, id, to, snapped)),
        reorder: (from, to) => edit((l) => ops.reorderWaypoint(l, from, to)),
        rename: (id, name) => edit((l) => ops.renameWaypoint(l, id, name)),
        reverse: () => edit((l) => (l.length > 1 ? ops.reverseRoute(l) : l)),
        clear: () => edit((l) => (l.length ? [] : l)),
        setWind: (wind) => set((s) => ({ route: { ...s.route, wind, updatedAt: new Date().toISOString() } })),
        setAlternates: (alternates) => set((s) => ({ route: { ...s.route, alternates, updatedAt: new Date().toISOString() } })),
        setCruiseAlt: (cruiseAltFt) => set((s) => ({ route: { ...s.route, cruiseAltFt, updatedAt: new Date().toISOString() } })),
        undo: () => {
          const { route, past } = get();
          if (!past.length) return;
          set({
            route: { ...route, waypoints: past[past.length - 1], updatedAt: new Date().toISOString() },
            past: past.slice(0, -1),
          });
        },
      };
    },
    {
      // The working route survives reloads; named saved routes come in step 8 (IndexedDB).
      name: 'bgvfr-route',
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({ route: s.route }),
      // Routes stored by older versions lack wind/altitude → fill defaults.
      merge: (persisted, current) => {
        const r = (persisted as { route?: Partial<Route> } | undefined)?.route;
        if (!r) return current;
        return { ...current, route: { ...emptyRoute(), ...r } };
      },
    },
  ),
);
