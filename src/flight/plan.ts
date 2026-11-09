import type { Aircraft, Route } from '../domain/types';
import { computeNavLog, type NavLog } from '../nav/navlog';

/** Nav log for the working route with the selected aircraft. */
export function buildNavLog(route: Route, aircraft: Aircraft, date = new Date()): NavLog {
  return computeNavLog({
    points: route.waypoints.map((w) => ({ lat: w.lat, lon: w.lon, name: w.name })),
    perf: {
      tasKt: aircraft.tasKt,
      fuelBurnPerHour: aircraft.fuelBurnPerHour,
      taxiFuel: aircraft.taxiFuel,
      reserveMinutes: aircraft.reserveMinutes,
      usableFuel: aircraft.usableFuel,
    },
    wind: { fromDeg: route.wind.fromDeg, speedKt: route.wind.speedKt },
    date,
  });
}

/** Signed WCA for display: "+5°", "−3°", "0°". */
export function formatWca(deg: number | null): string {
  if (deg == null) return '—';
  const r = Math.round(deg);
  if (r === 0) return '0°';
  return `${r > 0 ? '+' : '−'}${Math.abs(r)}°`;
}

/** Variation for tables: "5.8E" / "1.2W". */
export function formatVarShort(deg: number): string {
  return `${Math.abs(deg).toFixed(1)}${deg >= 0 ? 'E' : 'W'}`;
}

export function formatFuel(v: number | null | undefined, unit: string, dp = 1): string {
  return v == null || !Number.isFinite(v) ? '—' : `${v.toFixed(dp)} ${unit}`;
}
