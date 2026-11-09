/**
 * Position sources. The browser's Geolocation API uses whatever location
 * provider the phone has — including an external Bluetooth GNSS receiver
 * paired at system level (e.g. on iOS, MFi receivers replace the internal GPS).
 */
import type { Waypoint } from '../domain/types';
import { msToKt, pointAlongRoute, type Fix } from './navigation';

export type PositionError = 'denied' | 'unavailable' | 'timeout';

export interface PositionSource {
  readonly kind: 'gps' | 'sim';
  start(onFix: (f: Fix) => void, onError: (e: PositionError) => void): void;
  stop(): void;
}

export class GeolocationSource implements PositionSource {
  readonly kind = 'gps' as const;
  private watchId: number | null = null;

  start(onFix: (f: Fix) => void, onError: (e: PositionError) => void) {
    if (!('geolocation' in navigator)) {
      onError('unavailable');
      return;
    }
    this.watchId = navigator.geolocation.watchPosition(
      (p) => {
        const c = p.coords;
        onFix({
          lat: c.latitude,
          lon: c.longitude,
          altM: c.altitude ?? null,
          accuracyM: c.accuracy,
          speedKt: c.speed == null || Number.isNaN(c.speed) ? null : msToKt(c.speed),
          trackTrue: c.heading == null || Number.isNaN(c.heading) ? null : c.heading,
          time: p.timestamp || Date.now(),
        });
      },
      (e) => onError(e.code === e.PERMISSION_DENIED ? 'denied' : e.code === e.TIMEOUT ? 'timeout' : 'unavailable'),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30_000 },
    );
  }

  stop() {
    if (this.watchId != null) navigator.geolocation.clearWatch(this.watchId);
    this.watchId = null;
  }
}

/** Flies the route at a constant ground speed — for trying in-flight mode on the ground. */
export class SimulatedSource implements PositionSource {
  readonly kind = 'sim' as const;
  private timer: number | null = null;
  private readonly wps: Waypoint[];
  private readonly gsKt: number;
  private readonly speedup: number;
  private readonly altFt: number;

  constructor(wps: Waypoint[], gsKt: number, altFt: number, speedup = 10) {
    this.wps = wps;
    this.gsKt = gsKt;
    this.altFt = altFt;
    this.speedup = speedup;
  }

  start(onFix: (f: Fix) => void) {
    let dist = 0;
    const tick = () => {
      const { pos, trackTrue, done } = pointAlongRoute(this.wps, dist);
      onFix({
        lat: pos.lat, lon: pos.lon, altM: this.altFt * 0.3048, accuracyM: 5,
        speedKt: done ? 0 : this.gsKt, trackTrue, time: Date.now(),
      });
      if (!done) dist += (this.gsKt * this.speedup) / 3600;
    };
    tick();
    this.timer = window.setInterval(tick, 1000);
  }

  stop() {
    if (this.timer != null) clearInterval(this.timer);
    this.timer = null;
  }
}
