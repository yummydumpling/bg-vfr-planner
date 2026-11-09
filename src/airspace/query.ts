import { airspaceCategory, limitToFeet } from '../domain/format';
import type { AirspaceProps } from '../domain/types';
import type { AirspaceCollection } from '../data/source';
import type { LatLon } from '../nav/geo';
import { pointInGeometry } from './geometry';

/**
 * All airspaces containing a point, lowest lower-limit first.
 * FIR/UIR are skipped; `includeCategory` filters by visible layer groups.
 */
export function airspacesAt(
  fc: AirspaceCollection,
  p: LatLon,
  includeCategory: (cat: ReturnType<typeof airspaceCategory>) => boolean = () => true,
): AirspaceProps[] {
  return fc.features
    .filter((f) => {
      const cat = airspaceCategory(f.properties.type);
      return cat !== 'fir' && includeCategory(cat) && pointInGeometry(p, f.geometry);
    })
    .map((f) => f.properties)
    .sort((a, b) => limitToFeet(a.lower).ft - limitToFeet(b.lower).ft || limitToFeet(a.upper).ft - limitToFeet(b.upper).ft);
}
