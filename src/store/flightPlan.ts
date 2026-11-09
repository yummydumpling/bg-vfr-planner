import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { safeStorage } from './safeStorage';

export interface PilotDetails {
  name: string;
  phone: string;
  /** Add "RMK/PIC TEL <phone>" to item 18. */
  phoneInRemarks: boolean;
}

/** Per-flight values that are not part of the route or aircraft. */
export interface FplDraft {
  /** EOBT as ISO string (UTC). */
  eobt: string;
  persons: number;
  /** Item 15 level: VFR or the route's cruise altitude. */
  levelMode: 'VFR' | 'ALT';
  reportingPointNames: boolean;
  remarks: string;
}

/** Next half hour + 1 h, a sensible default off-block time. */
export function defaultEobt(now = new Date()): string {
  const d = new Date(now.getTime() + 60 * 60 * 1000);
  d.setUTCSeconds(0, 0);
  d.setUTCMinutes(d.getUTCMinutes() <= 30 ? 30 : 60);
  return d.toISOString();
}

interface FplState {
  pilot: PilotDetails;
  draft: FplDraft;
  setPilot: (p: Partial<PilotDetails>) => void;
  setDraft: (d: Partial<FplDraft>) => void;
}

export const useFlightPlan = create<FplState>()(
  persist(
    (set) => ({
      pilot: { name: '', phone: '', phoneInRemarks: true },
      draft: { eobt: defaultEobt(), persons: 1, levelMode: 'VFR', reportingPointNames: false, remarks: '' },
      setPilot: (p) => set((s) => ({ pilot: { ...s.pilot, ...p } })),
      setDraft: (d) => set((s) => ({ draft: { ...s.draft, ...d } })),
    }),
    {
      name: 'bgvfr-fpl',
      storage: createJSONStorage(() => safeStorage),
      // A stored EOBT in the past is useless for the next flight → refresh it.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<FplState>;
        const draft = { ...current.draft, ...(p.draft ?? {}) };
        if (new Date(draft.eobt).getTime() < Date.now() - 60 * 60 * 1000) draft.eobt = defaultEobt();
        return { ...current, ...p, pilot: { ...current.pilot, ...(p.pilot ?? {}) }, draft };
      },
    },
  ),
);
