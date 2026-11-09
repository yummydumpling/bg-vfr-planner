import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Aircraft } from '../domain/types';
import { AIRCRAFT_FPL_DEFAULTS, defaultAircraft } from '../flight/aircraft';
import { newId } from '../route/id';
import { safeStorage } from './safeStorage';

interface AircraftState {
  list: Aircraft[];
  selectedId: string;
  select: (id: string) => void;
  /** Insert or replace by id; selects it. */
  save: (a: Aircraft) => void;
  remove: (id: string) => void;
  duplicate: (id: string) => Aircraft | null;
}

const first = defaultAircraft();

export const useAircraft = create<AircraftState>()(
  persist(
    (set, get) => ({
      list: [first],
      selectedId: first.id,
      select: (selectedId) => set({ selectedId }),
      save: (a) =>
        set((s) => {
          const exists = s.list.some((x) => x.id === a.id);
          return { list: exists ? s.list.map((x) => (x.id === a.id ? a : x)) : [...s.list, a], selectedId: a.id };
        }),
      remove: (id) =>
        set((s) => {
          // always keep at least one profile
          const list = s.list.filter((x) => x.id !== id);
          const safe = list.length ? list : [defaultAircraft()];
          return { list: safe, selectedId: safe.some((x) => x.id === s.selectedId) ? s.selectedId : safe[0].id };
        }),
      duplicate: (id) => {
        const src = get().list.find((x) => x.id === id);
        if (!src) return null;
        return { ...src, id: newId(), name: `${src.name} (2)` };
      },
    }),
    {
      name: 'bgvfr-aircraft',
      storage: createJSONStorage(() => safeStorage),
      // Profiles saved by older versions lack the flight-plan fields.
      merge: (persisted, current) => {
        const p = persisted as Partial<AircraftState> | undefined;
        if (!p?.list?.length) return current;
        return { ...current, ...p, list: p.list.map((a) => ({ ...AIRCRAFT_FPL_DEFAULTS, ...a })) };
      },
    },
  ),
);

/** The currently selected profile (falls back to the first). */
export const useSelectedAircraft = (): Aircraft =>
  useAircraft((s) => s.list.find((a) => a.id === s.selectedId) ?? s.list[0]);
