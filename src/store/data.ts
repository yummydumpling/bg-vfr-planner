import { create } from 'zustand';
import { BundledSnapshotSource, type AeroData, type AeroDataSource } from '../data/source';

export type Selection =
  | { kind: 'airport'; id: string }
  | { kind: 'reporting'; id: string }
  | { kind: 'navaid'; id: string }
  | { kind: 'airspaces'; lat: number; lon: number; ids: string[]; focusId?: string };

/** Published daily by the data-refresh job (not precached, so it stays current online). */
export interface DataStatus {
  checkedAt: string;
}

interface DataState {
  data: AeroData | null;
  status: DataStatus | null;
  error: string | null;
  selection: Selection | null;
  load: (source?: AeroDataSource) => Promise<void>;
  select: (s: Selection | null) => void;
  /** Focus one airspace in the current airspace selection. */
  focusAirspace: (id: string) => void;
}

export const useData = create<DataState>()((set, get) => ({
  data: null,
  status: null,
  error: null,
  selection: null,
  load: async (source = new BundledSnapshotSource()) => {
    if (get().data) return;
    try {
      set({ data: await source.load(), error: null });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    }
    // Optional: when the data was last checked against openAIP
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}data/bg/status.json`, { cache: 'no-store' });
      if (res.ok) {
        const st = (await res.json()) as Partial<DataStatus>;
        if (st.checkedAt && !Number.isNaN(Date.parse(st.checkedAt))) set({ status: { checkedAt: st.checkedAt } });
      }
    } catch {
      /* offline or not published yet */
    }
  },
  select: (selection) => set({ selection }),
  focusAirspace: (id) =>
    set((s) => (s.selection?.kind === 'airspaces' ? { selection: { ...s.selection, focusId: id } } : {})),
}));
