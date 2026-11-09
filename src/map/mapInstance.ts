import type * as maplibregl from 'maplibre-gl';

/** The single live map, for UI outside MapView (e.g. "fit route"). */
let current: maplibregl.Map | null = null;
export const setMapInstance = (m: maplibregl.Map | null) => { current = m; };
export const getMapInstance = () => current;
