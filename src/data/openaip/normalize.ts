/**
 * openAIP Core API (v1.1) → domain model.
 * Enum values taken from the openAIP Core API specification.
 */
import type {
  Airport, AirportKind, AirspaceActivity, AirspaceClass, AirspaceProps, AirspaceType,
  AltitudeRef, AltitudeUnit, Frequency, FrequencyType, Navaid, NavaidKind, ReportingPoint,
  Runway, SurfaceKind, VerticalLimit,
} from '../../domain/types';

/* ---------- raw openAIP shapes (only the fields we use) ---------- */
interface OaValueUnit { value: number; unit: number; referenceDatum?: number }
interface OaPointGeom { type: 'Point'; coordinates: [number, number] }
export interface OaAirspace {
  _id: string; name: string; type: number; icaoClass: number; activity?: number;
  onDemand?: boolean; onRequest?: boolean; byNotam?: boolean; country: string;
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  upperLimit: OaValueUnit; lowerLimit: OaValueUnit;
}
export interface OaAirport {
  _id: string; name: string; icaoCode?: string; iataCode?: string; type: number;
  trafficType?: number[]; magneticDeclination?: number; country: string;
  geometry: OaPointGeom; elevation: OaValueUnit; ppr?: boolean; private?: boolean;
  frequencies?: { value: string; unit: number; type: number; name?: string; primary?: boolean }[];
  runways?: {
    designator: string; trueHeading: number; mainRunway?: boolean;
    surface?: { mainComposite?: number };
    dimension?: { length?: { value: number; unit: number }; width?: { value: number; unit: number } };
  }[];
}
export interface OaReportingPoint {
  _id: string; name: string; compulsory?: boolean; country: string; airports?: string[];
  geometry: OaPointGeom;
}
export interface OaNavaid {
  _id: string; name: string; identifier: string; type: number; country: string;
  frequency: { value: string; unit: number }; channel?: string;
  geometry: OaPointGeom; elevation?: OaValueUnit; magneticDeclination?: number;
}

/* ---------- enum maps ---------- */
const AIRSPACE_TYPE: AirspaceType[] = [
  'OTHER', 'R', 'D', 'P', 'CTR', 'TMZ', 'RMZ', 'TMA', 'TRA', 'TSA', 'FIR', 'UIR', 'ADIZ',
  'ATZ', 'MATZ', 'AWY', 'MTR', 'ALERT', 'WARNING', 'PROTECTED', 'HTZ', 'GLIDING', 'TRP',
  'TIZ', 'TIA', 'MTA', 'CTA', 'ACC', 'SPORT', 'LOW_OVERFLIGHT', 'MRT', 'TFR', 'VFR_SECTOR',
  'FIS', 'LTA', 'UTA', 'MCTR',
];
const AIRSPACE_CLASS: Record<number, AirspaceClass> = {
  0: 'A', 1: 'B', 2: 'C', 3: 'D', 4: 'E', 5: 'F', 6: 'G', 8: 'SUA',
};
const ACTIVITY: AirspaceActivity[] = ['NONE', 'PARACHUTING', 'AEROBATICS', 'AEROCLUB', 'ULM', 'HANG_GLIDING'];
const LIMIT_UNIT: Record<number, AltitudeUnit> = { 0: 'M', 1: 'FT', 6: 'FL' };
const LIMIT_REF: Record<number, AltitudeRef> = { 0: 'GND', 1: 'MSL', 2: 'STD' };
const AIRPORT_KIND: AirportKind[] = [
  'AIRPORT', 'GLIDER', 'AIRFIELD', 'INTL', 'HELI_MIL', 'MILITARY', 'ULTRALIGHT', 'HELI_CIVIL',
  'CLOSED', 'IFR_AIRFIELD', 'WATER', 'STRIP', 'AGRI_STRIP', 'ALTIPORT',
];
const FREQ_TYPE: FrequencyType[] = [
  'APP', 'APRON', 'ARR', 'CTR', 'CTAF', 'DEL', 'DEP', 'FIS', 'GLIDING', 'GND', 'INFO',
  'MULTICOM', 'UNICOM', 'RADAR', 'TWR', 'ATIS', 'RADIO', 'OTHER', 'AIRMET', 'AWOS', 'LIGHTS',
  'VOLMET', 'AFIS',
];
const NAVAID_KIND: NavaidKind[] = ['DME', 'TACAN', 'NDB', 'VOR', 'VOR-DME', 'VORTAC', 'DVOR', 'DVOR-DME', 'DVORTAC'];
/** openAIP surface composition codes → simplified kinds. */
const SURFACE: Record<number, SurfaceKind> = {
  0: 'ASPHALT', 1: 'CONCRETE', 2: 'GRASS', 3: 'SAND', 4: 'WATER', 5: 'ASPHALT', 7: 'GRAVEL',
  12: 'GRAVEL', 13: 'EARTH',
};
const PAVED_CODES = new Set([0, 1, 5, 6, 7]);

const M_TO_FT = 1 / 0.3048;
const round = (v: number, dp: number) => Math.round(v * 10 ** dp) / 10 ** dp;

export function normalizeLimit(l: OaValueUnit): VerticalLimit {
  return {
    value: l.value,
    unit: LIMIT_UNIT[l.unit] ?? 'FT',
    ref: LIMIT_REF[l.referenceDatum ?? 1] ?? 'MSL',
  };
}

function roundCoords<T extends GeoJSON.Polygon | GeoJSON.MultiPolygon>(g: T): T {
  const r = (ring: GeoJSON.Position[]) => ring.map(([x, y]) => [round(x, 5), round(y, 5)]);
  if (g.type === 'Polygon') return { ...g, coordinates: g.coordinates.map(r) };
  return { ...g, coordinates: (g as GeoJSON.MultiPolygon).coordinates.map((p) => p.map(r)) };
}

export function normalizeAirspace(a: OaAirspace): GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon, AirspaceProps> {
  return {
    type: 'Feature',
    id: a._id,
    geometry: roundCoords(a.geometry),
    properties: {
      id: a._id,
      name: a.name.trim(),
      type: AIRSPACE_TYPE[a.type] ?? 'OTHER',
      cls: AIRSPACE_CLASS[a.icaoClass] ?? 'SUA',
      lower: normalizeLimit(a.lowerLimit),
      upper: normalizeLimit(a.upperLimit),
      country: a.country,
      activity: ACTIVITY[a.activity ?? 0] ?? 'NONE',
      byNotam: !!a.byNotam,
      onRequest: !!a.onRequest,
      onDemand: !!a.onDemand,
    },
  };
}

function lengthM(d?: { value: number; unit: number }): number | undefined {
  if (!d) return undefined;
  // openAIP: 0 = metres, 1 = feet
  return Math.round(d.unit === 1 ? d.value * 0.3048 : d.value);
}

export function normalizeAirport(a: OaAirport): Airport {
  const [lon, lat] = a.geometry.coordinates;
  const elevFt = a.elevation.unit === 1 ? a.elevation.value : a.elevation.value * M_TO_FT;
  const runways: Runway[] = (a.runways ?? []).map((r) => {
    const code = r.surface?.mainComposite;
    return {
      designator: r.designator,
      trueHeading: r.trueHeading,
      lengthM: lengthM(r.dimension?.length),
      widthM: lengthM(r.dimension?.width),
      surface: code == null ? 'UNKNOWN' : SURFACE[code] ?? 'OTHER',
      main: !!r.mainRunway,
      paved: code != null && PAVED_CODES.has(code),
    };
  });
  const frequencies: Frequency[] = (a.frequencies ?? []).map((f) => ({
    mhz: f.value,
    type: FREQ_TYPE[f.type] ?? 'OTHER',
    name: (f.name ?? '').trim(),
    primary: !!f.primary,
  }));
  return {
    id: a._id,
    icao: a.icaoCode || undefined,
    iata: a.iataCode || undefined,
    name: a.name.trim(),
    kind: AIRPORT_KIND[a.type] ?? 'AIRFIELD',
    lat: round(lat, 6),
    lon: round(lon, 6),
    elevationFt: Math.round(elevFt),
    magVar: a.magneticDeclination,
    country: a.country,
    vfr: (a.trafficType ?? [0]).includes(0),
    ifr: (a.trafficType ?? []).includes(1),
    ppr: !!a.ppr,
    private: !!a.private,
    runways,
    frequencies,
  };
}

export function normalizeReportingPoint(p: OaReportingPoint, airportIcaoById: Map<string, string>): ReportingPoint {
  const [lon, lat] = p.geometry.coordinates;
  return {
    id: p._id,
    name: p.name.trim(),
    lat: round(lat, 6),
    lon: round(lon, 6),
    compulsory: p.compulsory ?? true,
    airports: (p.airports ?? []).map((id) => airportIcaoById.get(id)).filter((x): x is string => !!x),
    country: p.country,
  };
}

export function normalizeNavaid(n: OaNavaid): Navaid {
  const [lon, lat] = n.geometry.coordinates;
  return {
    id: n._id,
    ident: n.identifier,
    name: n.name.trim(),
    kind: NAVAID_KIND[n.type] ?? 'VOR',
    frequency: n.frequency.value,
    // openAIP frequency unit: 1 = kHz, 2 = MHz
    frequencyUnit: n.frequency.unit === 1 ? 'kHz' : 'MHz',
    channel: n.channel,
    lat: round(lat, 6),
    lon: round(lon, 6),
    elevationFt:
      n.elevation == null ? undefined
        : Math.round(n.elevation.unit === 1 ? n.elevation.value : n.elevation.value * M_TO_FT),
    magVar: n.magneticDeclination,
    country: n.country,
  };
}
