import { distanceNm, legTrack, midpoint, type LatLon } from './geo';
import { magneticVariation } from './magvar/wmm';
import { trueToMagnetic, windTriangle, type Wind } from './wind';

export interface NavPoint extends LatLon {
  name: string;
}

export interface PerformanceInput {
  /** True airspeed, knots. */
  tasKt: number;
  /** Fuel burn per hour (litres or US gal – unit agnostic). */
  fuelBurnPerHour: number;
  /** Fuel used for start-up, taxi and run-up. */
  taxiFuel: number;
  /** Final reserve, minutes at cruise burn (e.g. 30 day VFR, 45 night). */
  reserveMinutes: number;
  /** Usable fuel on board (optional – for remaining-fuel checks). */
  usableFuel?: number;
}

export interface NavLogInput {
  points: NavPoint[];
  perf: PerformanceInput;
  /** Wind for the whole route; can be overridden per leg. */
  wind: Wind;
  /** Optional per-leg wind (index = leg index). */
  legWinds?: (Wind | undefined)[];
  /** Date used for magnetic variation. */
  date?: Date;
}

export interface NavLeg {
  from: NavPoint;
  to: NavPoint;
  trueTrack: number;
  /** Magnetic variation at the leg midpoint, degrees, East positive. */
  variation: number;
  magTrack: number;
  wind: Wind;
  /** null when the leg cannot be flown with this wind/TAS */
  wca: number | null;
  trueHeading: number | null;
  magHeading: number | null;
  groundSpeed: number | null;
  distanceNm: number;
  /** Leg time in minutes (null if not flyable). */
  eteMin: number | null;
  cumDistanceNm: number;
  cumMin: number | null;
  /** Fuel for the leg (same unit as fuelBurnPerHour). */
  fuel: number | null;
  cumFuel: number | null;
}

export interface NavLogTotals {
  distanceNm: number;
  /** Total airborne time, minutes. */
  timeMin: number | null;
  tripFuel: number | null;
  taxiFuel: number;
  reserveFuel: number;
  /** taxi + trip + reserve */
  requiredFuel: number | null;
  /** usable − required (undefined if usable fuel not given). */
  extraFuel?: number | null;
  /** Endurance with usable fuel minus taxi, minutes. */
  enduranceMin?: number;
}

export interface NavLog {
  legs: NavLeg[];
  totals: NavLogTotals;
}

export function computeNavLog(input: NavLogInput): NavLog {
  const { points, perf, wind } = input;
  const date = input.date ?? new Date();
  const legs: NavLeg[] = [];
  let cumDist = 0;
  let cumMin: number | null = 0;
  let cumFuel: number | null = 0;

  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i];
    const to = points[i + 1];
    const legWind = input.legWinds?.[i] ?? wind;
    const dist = distanceNm(from, to);
    const tt = legTrack(from, to);
    const mid = midpoint(from, to);
    const variation = magneticVariation(mid.lat, mid.lon, date);
    const wt = dist > 0 ? windTriangle(tt, perf.tasKt, legWind) : null;
    const ete = wt ? (dist / wt.groundSpeedKt) * 60 : dist === 0 ? 0 : null;
    const fuel = ete == null ? null : (ete / 60) * perf.fuelBurnPerHour;

    cumDist += dist;
    cumMin = cumMin == null || ete == null ? null : cumMin + ete;
    cumFuel = cumFuel == null || fuel == null ? null : cumFuel + fuel;

    legs.push({
      from,
      to,
      trueTrack: tt,
      variation,
      magTrack: trueToMagnetic(tt, variation),
      wind: legWind,
      wca: wt?.wcaDeg ?? null,
      trueHeading: wt?.trueHeadingDeg ?? null,
      magHeading: wt ? trueToMagnetic(wt.trueHeadingDeg, variation) : null,
      groundSpeed: wt?.groundSpeedKt ?? null,
      distanceNm: dist,
      eteMin: ete,
      cumDistanceNm: cumDist,
      cumMin,
      fuel,
      cumFuel,
    });
  }

  const reserveFuel = (perf.reserveMinutes / 60) * perf.fuelBurnPerHour;
  const tripFuel = cumFuel;
  const requiredFuel = tripFuel == null ? null : perf.taxiFuel + tripFuel + reserveFuel;
  const totals: NavLogTotals = {
    distanceNm: cumDist,
    timeMin: cumMin,
    tripFuel,
    taxiFuel: perf.taxiFuel,
    reserveFuel,
    requiredFuel,
  };
  if (perf.usableFuel != null) {
    totals.extraFuel = requiredFuel == null ? null : perf.usableFuel - requiredFuel;
    totals.enduranceMin =
      perf.fuelBurnPerHour > 0
        ? (Math.max(0, perf.usableFuel - perf.taxiFuel) / perf.fuelBurnPerHour) * 60
        : 0;
  }
  return { legs, totals };
}

/** Format minutes as H:MM (e.g. 75.4 → "1:15"). */
export function formatDuration(min: number | null): string {
  if (min == null || !Number.isFinite(min)) return '--:--';
  const total = Math.round(min);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
