import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Lang } from '../i18n';
import { safeStorage } from './safeStorage';

export type Theme = 'light' | 'dark';

export type LayerKey =
  | 'controlled' | 'atz' | 'restricted' | 'zones' | 'fir' | 'other'
  | 'airports' | 'reporting' | 'navaids';

export const DEFAULT_LAYERS: Record<LayerKey, boolean> = {
  controlled: true,
  atz: true,
  restricted: true,
  zones: true,
  fir: true,
  other: false,
  airports: true,
  reporting: true,
  navaids: true,
};

interface SettingsState {
  lang: Lang;
  theme: Theme;
  layers: Record<LayerKey, boolean>;
  /** Version of the disclaimer the user acknowledged. */
  disclaimerAck: number;
  setLang: (l: Lang) => void;
  setTheme: (t: Theme) => void;
  toggleLayer: (k: LayerKey) => void;
  ackDisclaimer: () => void;
}

export const DISCLAIMER_VERSION = 1;

const prefersDark = () => {
  try { return window.matchMedia('(prefers-color-scheme: dark)').matches; } catch { return false; }
};
const browserLang = (): Lang => {
  try { return navigator.language?.toLowerCase().startsWith('bg') ? 'bg' : 'en'; } catch { return 'en'; }
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      lang: browserLang(),
      theme: prefersDark() ? 'dark' : 'light',
      layers: DEFAULT_LAYERS,
      disclaimerAck: 0,
      setLang: (lang) => set({ lang }),
      setTheme: (theme) => set({ theme }),
      toggleLayer: (k) => set((s) => ({ layers: { ...s.layers, [k]: !s.layers[k] } })),
      ackDisclaimer: () => set({ disclaimerAck: DISCLAIMER_VERSION }),
    }),
    {
      name: 'bgvfr-settings',
      storage: createJSONStorage(() => safeStorage),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<SettingsState>;
        return { ...current, ...p, layers: { ...DEFAULT_LAYERS, ...(p.layers ?? {}) } };
      },
    },
  ),
);
