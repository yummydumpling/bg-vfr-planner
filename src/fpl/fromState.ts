import type { Aircraft, Route } from '../domain/types';
import type { NavLog } from '../nav/navlog';
import type { FplDraft, PilotDetails } from '../store/flightPlan';
import type { FplInput } from './fpl';

/** Assemble flight-plan input from the route, aircraft profile, pilot and per-flight draft. */
export function fplInputFrom(route: Route, aircraft: Aircraft, pilot: PilotDetails, draft: FplDraft, log: NavLog | null): FplInput {
  const remarks = [
    draft.remarks.trim(),
    pilot.phoneInRemarks && pilot.phone.trim() ? `PIC TEL ${pilot.phone.trim()}` : '',
  ].filter(Boolean).join(' ');
  return {
    aircraftId: aircraft.registration || '',
    registration: aircraft.registration,
    flightRules: 'V',
    flightType: 'G',
    aircraftType: aircraft.icaoType,
    typeText: aircraft.name,
    wake: aircraft.wake,
    equipment: aircraft.equipment,
    surveillance: aircraft.surveillance,
    eobt: new Date(draft.eobt),
    speedKt: aircraft.tasKt,
    level: draft.levelMode === 'ALT' && Number.isFinite(route.cruiseAltFt) ? route.cruiseAltFt : 'VFR',
    waypoints: route.waypoints,
    reportingPointNames: draft.reportingPointNames,
    eetMin: log?.totals.timeMin ?? 0,
    alternates: route.alternates,
    remarks: remarks ? (/^RMK\//i.test(remarks) ? remarks : `RMK/${remarks}`) : '',
    enduranceMin: log?.totals.enduranceMin ?? 0,
    persons: draft.persons,
    radio: aircraft.emergencyRadio,
    survival: aircraft.survival,
    jackets: aircraft.jackets,
    colour: aircraft.colour,
    pilot: pilot.name,
  };
}
