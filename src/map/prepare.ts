/** Convert domain data into flat GeoJSON suitable for MapLibre styling. */
import { airspaceCategory, formatLimit, limitToFeet } from '../domain/format';
import type { Airport, AirspaceType, Navaid, ReportingPoint } from '../domain/types';
import type { AirspaceCollection } from '../data/source';

/** Colour family used by the map style. */
export type ColorKey =
  | 'ctr' | 'tma' | 'atz' | 'prohibited' | 'restricted' | 'danger' | 'tra' | 'zone' | 'glide' | 'fir' | 'other';

const COLOR_KEY: Partial<Record<AirspaceType, ColorKey>> = {
  CTR: 'ctr', MCTR: 'ctr', TMA: 'tma', CTA: 'tma',
  ATZ: 'atz', MATZ: 'atz', HTZ: 'atz', TIZ: 'atz', TIA: 'atz',
  P: 'prohibited', R: 'restricted', D: 'danger', ALERT: 'danger', WARNING: 'danger',
  TRA: 'tra', TSA: 'tra', MTA: 'tra', PROTECTED: 'restricted', LOW_OVERFLIGHT: 'restricted',
  TMZ: 'zone', RMZ: 'zone', TRP: 'zone', VFR_SECTOR: 'zone',
  GLIDING: 'glide', SPORT: 'glide',
  FIR: 'fir', UIR: 'fir', FIS: 'fir',
};
/** Types drawn with a solid boundary; everything else is dashed. */
const SOLID = new Set<AirspaceType>(['CTR', 'MCTR', 'TMA', 'CTA', 'P', 'FIR', 'UIR']);
/** Types whose name/limits are labelled along the boundary. */
const LABELLED = new Set<AirspaceType>(['CTR', 'MCTR', 'TMA', 'CTA', 'ATZ', 'MATZ', 'P', 'R', 'D', 'TRA', 'TSA', 'TMZ', 'RMZ']);
/** Draw order (higher on top). */
const ORDER: Record<string, number> = { fir: 0, other: 1, tma: 2, zone: 3, glide: 3, tra: 4, danger: 5, restricted: 6, ctr: 7, atz: 8, prohibited: 9 };

export function prepareAirspaces(fc: AirspaceCollection): GeoJSON.FeatureCollection {
  const features = fc.features.map((f) => {
    const p = f.properties;
    const ck = COLOR_KEY[p.type] ?? 'other';
    return {
      type: 'Feature' as const,
      geometry: f.geometry,
      properties: {
        id: p.id,
        name: p.name,
        type: p.type,
        cls: p.cls,
        cat: airspaceCategory(p.type),
        ck,
        solid: SOLID.has(p.type),
        labelled: LABELLED.has(p.type),
        lowerTxt: formatLimit(p.lower),
        upperTxt: formatLimit(p.upper),
        lowerFt: limitToFeet(p.lower).ft,
        order: ORDER[ck] ?? 1,
      },
    };
  });
  features.sort((a, b) => a.properties.order - b.properties.order);
  return { type: 'FeatureCollection', features };
}

export type AirportIcon = 'ap-major' | 'ap-paved' | 'ap-grass' | 'ap-glider' | 'ap-ul' | 'ap-heli' | 'ap-closed' | 'ap-mil';

export function airportIcon(a: Airport): AirportIcon {
  switch (a.kind) {
    case 'INTL': case 'AIRPORT': case 'IFR_AIRFIELD': return 'ap-major';
    case 'MILITARY': return 'ap-mil';
    case 'HELI_CIVIL': case 'HELI_MIL': return 'ap-heli';
    case 'CLOSED': return 'ap-closed';
    case 'GLIDER': return 'ap-glider';
    case 'ULTRALIGHT': return 'ap-ul';
    default: {
      const main = a.runways.find((r) => r.main) ?? a.runways[0];
      return main?.paved ? 'ap-paved' : 'ap-grass';
    }
  }
}

const point = (lon: number, lat: number): GeoJSON.Point => ({ type: 'Point', coordinates: [lon, lat] });

export function prepareAirports(list: Airport[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: list.map((a) => {
      const icon = airportIcon(a);
      const main = a.runways.find((r) => r.main) ?? a.runways[0];
      const rotates = icon !== 'ap-heli' && icon !== 'ap-closed' && !!main;
      return {
        type: 'Feature',
        geometry: point(a.lon, a.lat),
        properties: {
          id: a.id,
          label: a.icao ?? a.name,
          name: a.name,
          icon,
          rot: rotates ? main!.trueHeading % 180 : 0,
          // bigger aerodromes win label collisions
          rank: icon === 'ap-major' ? 0 : icon === 'ap-mil' ? 1 : a.icao ? 2 : 3,
        },
      };
    }),
  };
}

export function prepareReportingPoints(list: ReportingPoint[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: list.map((p) => ({
      type: 'Feature',
      geometry: point(p.lon, p.lat),
      properties: { id: p.id, name: p.name, icon: p.compulsory ? 'rp-comp' : 'rp-req' },
    })),
  };
}

export function prepareNavaids(list: Navaid[]): GeoJSON.FeatureCollection {
  const icon = (n: Navaid) =>
    n.kind === 'NDB' ? 'nav-ndb' : n.kind === 'DME' ? 'nav-dme' : n.kind.includes('DME') || n.kind.includes('TAC') ? 'nav-vordme' : 'nav-vor';
  return {
    type: 'FeatureCollection',
    features: list.map((n) => ({
      type: 'Feature',
      geometry: point(n.lon, n.lat),
      properties: { id: n.id, label: `${n.ident} ${n.frequency}`, icon: icon(n) },
    })),
  };
}
