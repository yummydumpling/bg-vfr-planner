import type { Aircraft } from '../domain/types';
import { newId } from '../route/id';

/** A neutral starting profile (typical light four-seater); the pilot must check it. */
export function defaultAircraft(): Aircraft {
  return {
    id: newId(),
    name: 'C172',
    registration: '',
    icaoType: 'C172',
    tasKt: 105,
    fuelBurnPerHour: 32,
    usableFuel: 200,
    taxiFuel: 5,
    reserveMinutes: 30,
    fuelUnit: 'L',
  };
}

export type AircraftErrors = Partial<Record<keyof Aircraft, string>>;

/** Returns error keys (i18n keys) per field; empty object = valid. */
export function validateAircraft(a: Aircraft): AircraftErrors {
  const e: AircraftErrors = {};
  const num = (v: number) => Number.isFinite(v);
  if (!a.name.trim()) e.name = 'errRequired';
  if (!num(a.tasKt) || a.tasKt < 30 || a.tasKt > 400) e.tasKt = 'errTas';
  if (!num(a.fuelBurnPerHour) || a.fuelBurnPerHour <= 0 || a.fuelBurnPerHour > 500) e.fuelBurnPerHour = 'errPositive';
  if (!num(a.usableFuel) || a.usableFuel <= 0 || a.usableFuel > 5000) e.usableFuel = 'errPositive';
  if (!num(a.taxiFuel) || a.taxiFuel < 0 || a.taxiFuel >= a.usableFuel) e.taxiFuel = 'errTaxi';
  if (!num(a.reserveMinutes) || a.reserveMinutes < 0 || a.reserveMinutes > 180) e.reserveMinutes = 'errReserve';
  if (a.icaoType && !/^[A-Z0-9]{2,4}$/.test(a.icaoType)) e.icaoType = 'errIcaoType';
  return e;
}
