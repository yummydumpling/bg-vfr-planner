import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { WX_PROXY_URL } from '../weather/config';
import { ProxyWeatherSource, type Metar, type Taf, type WeatherSource } from '../weather/weather';
import { safeStorage } from './safeStorage';

export interface StationWeather {
  metar?: Metar;
  taf?: Taf;
  /** When we last asked for this station (ISO). */
  fetchedAt: string;
}

/** Don't re-ask for a station more often than this unless forced. */
const MIN_REFETCH_MS = 5 * 60 * 1000;
/** Drop stored reports older than this (keeps storage small). */
const KEEP_MS = 36 * 60 * 60 * 1000;

interface WeatherState {
  stations: Record<string, StationWeather>;
  loading: boolean;
  error: string | null;
  configured: boolean;
  refresh: (ids: string[], force?: boolean) => Promise<void>;
}

let source: WeatherSource | null = WX_PROXY_URL ? new ProxyWeatherSource(WX_PROXY_URL) : null;
/** For tests. */
export const setWeatherSource = (s: WeatherSource | null) => {
  source = s;
  useWeather.setState({ configured: !!s });
};

export const useWeather = create<WeatherState>()(
  persist(
    (set, get) => ({
      stations: {},
      loading: false,
      error: null,
      configured: !!source,
      refresh: async (ids, force = false) => {
        if (!source) return;
        const now = Date.now();
        const wanted = [...new Set(ids.map((i) => i.toUpperCase()).filter((i) => /^[A-Z]{4}$/.test(i)))].filter((id) => {
          const s = get().stations[id];
          return force || !s || now - Date.parse(s.fetchedAt) > MIN_REFETCH_MS;
        });
        if (!wanted.length) return;
        set({ loading: true, error: null });
        try {
          const [metars, tafs] = await Promise.all([source.metars(wanted), source.tafs(wanted)]);
          const fetchedAt = new Date().toISOString();
          const stations = { ...get().stations };
          for (const id of wanted) {
            stations[id] = {
              // keep the previous report if the service temporarily has none
              metar: metars.find((m) => m.icao === id) ?? stations[id]?.metar,
              taf: tafs.find((t) => t.icao === id) ?? stations[id]?.taf,
              fetchedAt,
            };
          }
          for (const [id, s] of Object.entries(stations)) {
            if (Date.now() - Date.parse(s.fetchedAt) > KEEP_MS) delete stations[id];
          }
          set({ stations, loading: false });
        } catch (e) {
          set({ loading: false, error: e instanceof Error ? e.message : String(e) });
        }
      },
    }),
    {
      name: 'bgvfr-weather',
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({ stations: s.stations }),
    },
  ),
);
