/** Coordinate formatting & parsing. */

interface DegMin {
  deg: number;
  min: number;
}

/** Split |value| into whole degrees and minutes rounded to `minDecimals`. */
function toDegMin(value: number, minDecimals: number): DegMin {
  const abs = Math.abs(value);
  let deg = Math.floor(abs);
  const factor = 10 ** minDecimals;
  let min = Math.round((abs - deg) * 60 * factor) / factor;
  if (min >= 60) {
    min -= 60;
    deg += 1;
  }
  return { deg, min };
}

const pad = (n: number, width: number) => String(n).padStart(width, '0');

/**
 * ICAO flight-plan significant point (Item 15) as degrees and minutes:
 * 2 digits lat deg + 2 digits min + N/S, 3 digits lon deg + 2 digits min + E/W.
 * e.g. 42.6833, 23.3833 → "4241N02323E" (rounded to the nearest minute).
 */
export function formatItem15Coord(lat: number, lon: number): string {
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) throw new RangeError('Coordinate out of range');
  const la = toDegMin(lat, 0);
  const lo = toDegMin(lon, 0);
  // Rounding 179°59.6' would give 180°00' which is still valid.
  return (
    pad(la.deg, 2) + pad(la.min, 2) + (lat < 0 ? 'S' : 'N') +
    pad(lo.deg, 3) + pad(lo.min, 2) + (lon < 0 ? 'W' : 'E')
  );
}

/** Display format: 42°41.2'N 023°23.5'E */
export function formatDegMin(lat: number, lon: number, minDecimals = 1): string {
  const la = toDegMin(lat, minDecimals);
  const lo = toDegMin(lon, minDecimals);
  const m = (v: number) => v.toFixed(minDecimals).padStart(minDecimals > 0 ? 3 + minDecimals : 2, '0');
  return `${pad(la.deg, 2)}°${m(la.min)}'${lat < 0 ? 'S' : 'N'} ${pad(lo.deg, 3)}°${m(lo.min)}'${lon < 0 ? 'W' : 'E'}`;
}

/** Display format: 42°41'12"N 023°23'00"E */
export function formatDMS(lat: number, lon: number): string {
  const f = (v: number, degWidth: number, hemi: string) => {
    const totalSec = Math.round(Math.abs(v) * 3600);
    const d = Math.floor(totalSec / 3600);
    const mn = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${pad(d, degWidth)}°${pad(mn, 2)}'${pad(s, 2)}"${hemi}`;
  };
  return `${f(lat, 2, lat < 0 ? 'S' : 'N')} ${f(lon, 3, lon < 0 ? 'W' : 'E')}`;
}

/**
 * Parse common pilot coordinate inputs into decimal degrees.
 * Accepts: "4241N02323E", "424112N0232300E", "42.6833 23.3833",
 * "42°41.2'N 23°23.5'E", "42 41 12 N 23 23 00 E".
 */
export function parseCoordinate(input: string): { lat: number; lon: number } | null {
  const s = input.trim().toUpperCase();

  // Compact ICAO forms: DDMM[SS]N DDDMM[SS]E
  const compact = /^(\d{2})(\d{2})(\d{2})?([NS])\s*(\d{3})(\d{2})(\d{2})?([EW])$/.exec(s);
  if (compact) {
    const [, la, lam, las, ns, lo, lom, los, ew] = compact;
    const lat = (+la + +lam / 60 + (las ? +las / 3600 : 0)) * (ns === 'S' ? -1 : 1);
    const lon = (+lo + +lom / 60 + (los ? +los / 3600 : 0)) * (ew === 'W' ? -1 : 1);
    return valid(lat, lon);
  }

  // Decimal pair: "42.68, 23.38" or "42.68 23.38"
  const dec = /^(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)$/.exec(s);
  if (dec) return valid(+dec[1], +dec[2]);

  // Hemisphere-tagged D M S with arbitrary separators
  const parts = /^(.*?)([NS])[\s,]*(.*?)([EW])$/.exec(s);
  if (parts) {
    const lat = dmsToDec(parts[1]);
    const lon = dmsToDec(parts[3]);
    if (lat == null || lon == null) return null;
    return valid(lat * (parts[2] === 'S' ? -1 : 1), lon * (parts[4] === 'W' ? -1 : 1));
  }
  return null;
}

function dmsToDec(text: string): number | null {
  const nums = text.match(/\d+(?:\.\d+)?/g);
  if (!nums || nums.length > 3) return null;
  const [d, m = '0', sec = '0'] = nums;
  if (+m >= 60 || +sec >= 60) return null;
  return +d + +m / 60 + +sec / 3600;
}

function valid(lat: number, lon: number) {
  return Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { lat, lon } : null;
}
