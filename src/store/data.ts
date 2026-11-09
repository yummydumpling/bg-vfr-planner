import { create } from 'zustand';
import { BundledSnapshotSource, type AeroData, type AeroDataSource } from '../data/source';

export type Selection =
  | { kind: 'airport'; id: string }
  | { kind: 'reporting'; id: string }
  | { kind: 'navaid'; id: string }
  | { kind: 'airspaces'; lat: number; lon: number; ids: string[] };

interface DataState {
  data: AeroData | null;
  error: string | null;
  selection: Selection | null;
  load: (source?: AeroDataSource) => Promise<void>;
  select: (s: Selection | null) => void;
}

export const useData = create<DataState>()((set, get) => ({
  data: null,
  error: null,
  selection: null,
  load: async (source = new BundledSnapshotSource()) => {
    if (get().data) return;
    try {
      set({ data: await source.load(), error: null });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    }
  },
  select: (selection) => set({ selection }),
}));
