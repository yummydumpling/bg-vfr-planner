import { create } from 'zustand';
import { closestLeg, sequenceLeg, withMotion, type Fix } from '../inflight/navigation';
import { GeolocationSource, SimulatedSource, type PositionError, type PositionSource } from '../inflight/position';
import { useRoute } from './route';

/** No fix for this long → "GPS lost". */
export const FIX_TIMEOUT_MS = 10_000;
const MAX_TRAIL = 20_000;

export type GpsStatus = 'acquiring' | 'ok' | 'lost' | PositionError;

interface InflightState {
  active: boolean;
  mode: 'gps' | 'sim';
  status: GpsStatus;
  fix: Fix | null;
  activeLeg: number;
  /** Has the leg been chosen from the first fix yet? */
  legSet: boolean;
  /** Pilot chose the leg: advance only on reaching the waypoint. */
  manualLeg: boolean;
  follow: boolean;
  /** Flown track [lon, lat] (kept for the later flight-log phase). */
  trail: [number, number][];
  start: (mode: 'gps' | 'sim') => void;
  stop: () => void;
  setFollow: (on: boolean) => void;
  nextLeg: () => void;
  prevLeg: () => void;
}

let source: PositionSource | null = null;
let watchdog: number | null = null;
let wakeLock: { release: () => Promise<void> } | null = null;

async function keepAwake(on: boolean) {
  try {
    if (on && 'wakeLock' in navigator && !wakeLock) {
      wakeLock = await (navigator as Navigator & { wakeLock: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock.request('screen');
      (wakeLock as unknown as EventTarget).addEventListener?.('release', () => { wakeLock = null; });
    } else if (!on && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch {
    wakeLock = null; // not supported or refused (e.g. low battery mode)
  }
}

// The wake lock is dropped when the app goes to the background — re-take it on return.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && useInflight.getState().active) void keepAwake(true);
  });
}

export const useInflight = create<InflightState>()((set, get) => ({
  active: false,
  mode: 'gps',
  status: 'acquiring',
  fix: null,
  activeLeg: 0,
  legSet: false,
  manualLeg: false,
  follow: true,
  trail: [],
  start: (mode) => {
    get().stop();
    const route = useRoute.getState().route;
    source = mode === 'sim'
      ? new SimulatedSource(route.waypoints, 110, route.cruiseAltFt)
      : new GeolocationSource();
    set({ active: true, mode, status: 'acquiring', fix: null, activeLeg: 0, legSet: false, manualLeg: false, follow: true, trail: [] });
    source.start(
      (raw) => {
        const s = get();
        const fix = withMotion(s.fix, raw);
        const wps = useRoute.getState().route.waypoints;
        let leg = s.activeLeg;
        let legSet = s.legSet;
        if (wps.length >= 2) {
          if (!legSet) { leg = closestLeg(wps, fix); legSet = true; }
          const next = sequenceLeg(wps, leg, fix, { abeam: !s.manualLeg });
          if (next !== leg) set({ manualLeg: false });
          leg = next;
        }
        const trail = s.trail.length >= MAX_TRAIL ? s.trail.slice(-MAX_TRAIL / 2) : s.trail;
        set({ fix, status: 'ok', activeLeg: leg, legSet, trail: [...trail, [fix.lon, fix.lat]] });
      },
      (err) => set({ status: err }),
    );
    watchdog = window.setInterval(() => {
      const { fix, status } = get();
      if (status === 'ok' && fix && Date.now() - fix.time > FIX_TIMEOUT_MS) set({ status: 'lost' });
    }, 2000);
    void keepAwake(true);
  },
  stop: () => {
    source?.stop();
    source = null;
    if (watchdog != null) clearInterval(watchdog);
    watchdog = null;
    void keepAwake(false);
    set({ active: false });
  },
  setFollow: (follow) => set({ follow }),
  nextLeg: () => {
    const n = useRoute.getState().route.waypoints.length;
    set((s) => ({ activeLeg: Math.min(s.activeLeg + 1, Math.max(0, n - 2)), legSet: true, manualLeg: true }));
  },
  prevLeg: () => set((s) => ({ activeLeg: Math.max(0, s.activeLeg - 1), legSet: true, manualLeg: true })),
}));
