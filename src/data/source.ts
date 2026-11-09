/**
 * Data-source abstraction. The app only talks to `AeroDataSource`, so the
 * bundled openAIP snapshot can later be swapped for another provider.
 */
import type { Airport, AirspaceProps, DatasetMeta, Navaid, ReportingPoint } from '../domain/types';

export type AirspaceCollection = GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon, AirspaceProps>;

export interface AeroData {
  airspaces: AirspaceCollection;
  airports: Airport[];
  reportingPoints: ReportingPoint[];
  navaids: Navaid[];
  meta: DatasetMeta;
}

export interface AeroDataSource {
  load(): Promise<AeroData>;
}

/** Static JSON snapshot bundled with the app (works offline via the service worker). */
export class BundledSnapshotSource implements AeroDataSource {
  private readonly baseUrl: string;
  constructor(baseUrl = `${import.meta.env.BASE_URL}data/bg/`) {
    this.baseUrl = baseUrl;
  }

  private async get<T>(file: string): Promise<T> {
    const res = await fetch(this.baseUrl + file);
    if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
    return (await res.json()) as T;
  }

  async load(): Promise<AeroData> {
    const [airspaces, airports, reportingPoints, navaids, meta] = await Promise.all([
      this.get<AirspaceCollection>('airspaces.geojson'),
      this.get<Airport[]>('airports.json'),
      this.get<ReportingPoint[]>('reporting-points.json'),
      this.get<Navaid[]>('navaids.json'),
      this.get<DatasetMeta>('meta.json'),
    ]);
    return { airspaces, airports, reportingPoints, navaids, meta };
  }
}
