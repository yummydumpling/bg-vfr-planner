/**
 * Map symbols drawn programmatically on a canvas (original artwork).
 * Runway-bearing aerodrome icons are drawn north-up and rotated by the map.
 */
import type * as maplibregl from 'maplibre-gl';
import type { Theme } from '../store/settings';

const SIZE = 32; // CSS px
const RATIO = 2;

interface Ink {
  civil: string;
  mil: string;
  sport: string;
  rp: string;
  nav: string;
  halo: string;
}

export const INK: Record<Theme, Ink> = {
  light: { civil: '#1c5fad', mil: '#a61e4d', sport: '#2b8a3e', rp: '#0b5d8a', nav: '#4c2a9e', halo: '#ffffff' },
  dark: { civil: '#8ec5ff', mil: '#f783ac', sport: '#8ce99a', rp: '#66d9e8', nav: '#b197fc', halo: '#0b0f14' },
};

type Draw = (c: CanvasRenderingContext2D, ink: Ink) => void;

const C = SIZE / 2;

/** Stroke the same path twice: a wide halo then the colour. */
function haloStroke(c: CanvasRenderingContext2D, ink: Ink, colour: string, width: number, path: () => void) {
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.strokeStyle = ink.halo;
  c.lineWidth = width + 3;
  path();
  c.stroke();
  c.strokeStyle = colour;
  c.lineWidth = width;
  path();
  c.stroke();
}

const ring = (r: number) => (c: CanvasRenderingContext2D) => {
  c.beginPath();
  c.arc(C, C, r, 0, Math.PI * 2);
};
const bar = (h: number) => (c: CanvasRenderingContext2D) => {
  c.beginPath();
  c.moveTo(C, C - h / 2);
  c.lineTo(C, C + h / 2);
};

function aerodrome(colour: (i: Ink) => string, opts: { filledBar: boolean; double?: boolean; dashed?: boolean; barLen?: number }): Draw {
  return (c, ink) => {
    const col = colour(ink);
    if (opts.dashed) c.setLineDash([3, 2.5]);
    haloStroke(c, ink, col, 2.2, () => ring(8)(c));
    c.setLineDash([]);
    if (opts.double) haloStroke(c, ink, col, 1.4, () => ring(4.5)(c));
    const len = opts.barLen ?? 24;
    if (opts.filledBar) {
      haloStroke(c, ink, col, 4, () => bar(len)(c));
    } else {
      // open runway: two thin rails
      haloStroke(c, ink, col, 1.4, () => {
        c.beginPath();
        c.rect(C - 2.2, C - len / 2, 4.4, len);
      });
    }
  };
}

const ICONS: Record<string, Draw> = {
  'ap-major': (c, ink) => {
    c.fillStyle = ink.halo;
    ring(10.5)(c);
    c.fill();
    c.fillStyle = ink.civil;
    ring(9)(c);
    c.fill();
    c.strokeStyle = ink.halo;
    c.lineWidth = 3.4;
    c.lineCap = 'butt';
    bar(22)(c);
    c.stroke();
  },
  'ap-paved': aerodrome((i) => i.civil, { filledBar: true }),
  'ap-grass': aerodrome((i) => i.civil, { filledBar: false }),
  'ap-mil': aerodrome((i) => i.mil, { filledBar: true, double: true }),
  'ap-ul': aerodrome((i) => i.sport, { filledBar: false, dashed: true, barLen: 20 }),
  'ap-glider': (c, ink) => {
    aerodrome((i) => i.sport, { filledBar: false, barLen: 20 })(c, ink);
    // small glider wings across the circle
    haloStroke(c, ink, ink.sport, 1.6, () => {
      c.beginPath();
      c.moveTo(C - 11, C - 1);
      c.quadraticCurveTo(C, C - 4, C + 11, C - 1);
    });
  },
  'ap-heli': (c, ink) => {
    haloStroke(c, ink, ink.civil, 2.2, () => ring(9)(c));
    haloStroke(c, ink, ink.civil, 2, () => {
      c.beginPath();
      c.moveTo(C - 4, C - 5); c.lineTo(C - 4, C + 5);
      c.moveTo(C + 4, C - 5); c.lineTo(C + 4, C + 5);
      c.moveTo(C - 4, C); c.lineTo(C + 4, C);
    });
  },
  'ap-closed': (c, ink) => {
    haloStroke(c, ink, ink.mil, 2, () => ring(8)(c));
    haloStroke(c, ink, ink.mil, 2, () => {
      c.beginPath();
      c.moveTo(C - 6, C - 6); c.lineTo(C + 6, C + 6);
      c.moveTo(C + 6, C - 6); c.lineTo(C - 6, C + 6);
    });
  },
  'rp-comp': (c, ink) => triangle(c, ink, true),
  'rp-req': (c, ink) => triangle(c, ink, false),
  'nav-vor': (c, ink) => hexagon(c, ink),
  'nav-vordme': (c, ink) => {
    haloStroke(c, ink, ink.nav, 1.6, () => {
      c.beginPath();
      c.rect(C - 9, C - 8, 18, 16);
    });
    hexagon(c, ink);
  },
  'nav-dme': (c, ink) => {
    haloStroke(c, ink, ink.nav, 2, () => {
      c.beginPath();
      c.rect(C - 7, C - 6, 14, 12);
    });
    dot(c, ink.nav, 2);
  },
  'nav-ndb': (c, ink) => {
    for (const r of [4, 7, 10]) {
      const n = r * 2;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        c.fillStyle = ink.nav;
        c.beginPath();
        c.arc(C + r * Math.cos(a), C + r * Math.sin(a), 0.9, 0, Math.PI * 2);
        c.fill();
      }
    }
    dot(c, ink.nav, 2);
  },
};

function dot(c: CanvasRenderingContext2D, colour: string, r: number) {
  c.fillStyle = colour;
  c.beginPath();
  c.arc(C, C, r, 0, Math.PI * 2);
  c.fill();
}

function triangle(c: CanvasRenderingContext2D, ink: Ink, filled: boolean) {
  const path = () => {
    c.beginPath();
    c.moveTo(C, C - 8);
    c.lineTo(C + 7.5, C + 5.5);
    c.lineTo(C - 7.5, C + 5.5);
    c.closePath();
  };
  haloStroke(c, ink, ink.rp, 2, path);
  if (filled) {
    c.fillStyle = ink.rp;
    path();
    c.fill();
  }
}

function hexagon(c: CanvasRenderingContext2D, ink: Ink) {
  haloStroke(c, ink, ink.nav, 2, () => {
    c.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i;
      const x = C + 6.5 * Math.cos(a);
      const y = C + 6.5 * Math.sin(a);
      if (i === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.closePath();
  });
  dot(c, ink.nav, 1.6);
}

export const ICON_NAMES = Object.keys(ICONS);

export function addIcons(map: maplibregl.Map, theme: Theme) {
  const ink = INK[theme];
  for (const [name, draw] of Object.entries(ICONS)) {
    const canvas = document.createElement('canvas');
    canvas.width = SIZE * RATIO;
    canvas.height = SIZE * RATIO;
    const c = canvas.getContext('2d');
    if (!c) continue;
    c.scale(RATIO, RATIO);
    draw(c, ink);
    const img = c.getImageData(0, 0, canvas.width, canvas.height);
    if (map.hasImage(name)) map.removeImage(name);
    map.addImage(name, img, { pixelRatio: RATIO });
  }
}
