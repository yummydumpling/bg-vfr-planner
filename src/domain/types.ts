/**
 * Source-independent domain model. Loaders (openAIP today, maybe others
 * later) normalise their data into these shapes.
 */

export type AltitudeUnit = 'FT' | 'FL' | 'M';
export type AltitudeRef = 'GND' | 'MSL' | 'STD';

export interface VerticalLimit {
  value: number;
  unit: AltitudeUnit;
  ref: AltitudeRef;
}

export type AirspaceType =
  | 'CTR' | 'TMA' | 'CTA' | 'ATZ' | 'MATZ' | 'MCTR' | 'HTZ' | 'TIZ' | 'TIA'
  | 'P' | 'R' | 'D' | 'TRA' | 'TSA' | 'MTA' | 'TMZ' | 'RMZ' | 'FIR' | 'UIR'
  | 'ADIZ' | 'AWY' | 'MTR' | 'ALERT' | 'WARNING' | 'PROTECTED' | 'GLIDING'
  | 'TRP' | 'ACC' | 'SPORT' | 'LOW_OVERFLIGHT' | 'MRT' | 'TFR' | 'VFR_SECTOR'
  | 'FIS' | 'LTA' | 'UTA' | 'OTHER';

export type AirspaceClass = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'SUA';

export type AirspaceActivity = 'NONE' | 'PARACHUTING' | 'AEROBATICS' | 'AEROCLUB' | 'ULM' | 'HANG_GLIDING';

/** Properties carried on each airspace GeoJSON feature. */
export interface AirspaceProps {
  id: string;
  name: string;
  type: AirspaceType;
  cls: AirspaceClass;
  lower: VerticalLimit;
  upper: VerticalLimit;
  country: string;
  activity: AirspaceActivity;
  byNotam: boolean;
  onRequest: boolean;
  onDemand: boolean;
  /** Placeholder for AUP/UUP activation data (later phase). */
  activation?: { active: boolean; source: string; validUntil?: string };
}

export type AirportKind =
  | 'INTL' | 'AIRPORT' | 'AIRFIELD' | 'IFR_AIRFIELD' | 'GLIDER' | 'ULTRALIGHT'
  | 'HELI_CIVIL' | 'HELI_MIL' | 'MILITARY' | 'CLOSED' | 'WATER' | 'STRIP'
  | 'AGRI_STRIP' | 'ALTIPORT';

export type SurfaceKind =
  | 'ASPHALT' | 'CONCRETE' | 'GRASS' | 'SAND' | 'WATER' | 'GRAVEL' | 'EARTH' | 'OTHER' | 'UNKNOWN';

export interface Runway {
  designator: string;
  trueHeading: number;
  lengthM?: number;
  widthM?: number;
  surface: SurfaceKind;
  main: boolean;
  /** Paved surfaces: asphalt, concrete, bituminous… */
  paved: boolean;
}

export type FrequencyType =
  | 'APP' | 'APRON' | 'ARR' | 'CTR' | 'CTAF' | 'DEL' | 'DEP' | 'FIS' | 'GLIDING'
  | 'GND' | 'INFO' | 'MULTICOM' | 'UNICOM' | 'RADAR' | 'TWR' | 'ATIS' | 'RADIO'
  | 'OTHER' | 'AIRMET' | 'AWOS' | 'LIGHTS' | 'VOLMET' | 'AFIS';

export interface Frequency {
  mhz: string;
  type: FrequencyType;
  name: string;
  primary: boolean;
}

export interface Airport {
  id: string;
  icao?: string;
  iata?: string;
  name: string;
  kind: AirportKind;
  lat: number;
  lon: number;
  elevationFt: number;
  magVar?: number;
  country: string;
  vfr: boolean;
  ifr: boolean;
  ppr: boolean;
  private: boolean;
  runways: Runway[];
  frequencies: Frequency[];
}

export interface ReportingPoint {
  id: string;
  name: string;
  lat: number;
  lon: number;
  compulsory: boolean;
  /** ICAO codes of associated aerodromes (when resolvable). */
  airports: string[];
  country: string;
}

export type NavaidKind = 'DME' | 'TACAN' | 'NDB' | 'VOR' | 'VOR-DME' | 'VORTAC' | 'DVOR' | 'DVOR-DME' | 'DVORTAC';

export interface Navaid {
  id: string;
  ident: string;
  name: string;
  kind: NavaidKind;
  /** MHz for VOR/DME family, kHz for NDB. */
  frequency: string;
  frequencyUnit: 'MHz' | 'kHz';
  channel?: string;
  lat: number;
  lon: number;
  elevationFt?: number;
  magVar?: number;
  country: string;
}

export interface DatasetMeta {
  source: string;
  sourceUrl: string;
  licence: string;
  licenceUrl: string;
  attribution: string;
  fetchedAt: string;
  countries: string[];
  counts: Record<string, number>;
}

export type WaypointKind = 'user' | 'airport' | 'reporting' | 'navaid';

export interface Waypoint {
  id: string;
  lat: number;
  lon: number;
  /** Display name: ICAO code, reporting point name, navaid ident or coordinates. */
  name: string;
  kind: WaypointKind;
  /** Id of the source object (airport/reporting point/navaid) when snapped. */
  refId?: string;
}

export interface RouteWind {
  /** Direction the wind blows from, degrees TRUE (as forecast). */
  fromDeg: number;
  speedKt: number;
}

export interface Route {
  id: string;
  name: string;
  waypoints: Waypoint[];
  /** Planned cruise altitude, ft AMSL. */
  cruiseAltFt: number;
  wind: RouteWind;
  updatedAt: string;
}

export type FuelUnit = 'L' | 'USG';

export interface Aircraft {
  id: string;
  /** Free name, e.g. "Club C172". */
  name: string;
  /** Registration / call sign, e.g. "LZ-ABC" (used for the flight plan later). */
  registration: string;
  /** ICAO type designator, e.g. "C172" (flight plan item 9). */
  icaoType: string;
  tasKt: number;
  /** Cruise fuel flow per hour in `fuelUnit`. */
  fuelBurnPerHour: number;
  usableFuel: number;
  taxiFuel: number;
  /** Final reserve in minutes at cruise burn. */
  reserveMinutes: number;
  fuelUnit: FuelUnit;
}
