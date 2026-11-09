/** Small inline SVG UI icons (original). */
const base = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };

export const IconLayers = () => (
  <svg {...base}><path d="M12 3 2 8l10 5 10-5-10-5Z" /><path d="m2 13 10 5 10-5" /><path d="m2 18 10 5 10-5" opacity=".5" /></svg>
);
export const IconMoon = () => (
  <svg {...base}><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" /></svg>
);
export const IconSun = () => (
  <svg {...base}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
);
export const IconClose = () => (
  <svg {...base}><path d="M6 6l12 12M18 6 6 18" /></svg>
);
export const IconWarning = () => (
  <svg {...base} width={16} height={16}><path d="M12 3 2 20h20L12 3Z" /><path d="M12 10v4M12 17h.01" /></svg>
);
export const IconExternal = () => (
  <svg {...base} width={14} height={14}><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>
);
export const IconRoute = () => (
  <svg {...base}><circle cx="5" cy="18" r="2.5" /><circle cx="19" cy="6" r="2.5" /><path d="M7.5 17.5c6-1 2-9 9-10.5" strokeDasharray="0" /></svg>
);
export const IconUndo = () => (
  <svg {...base} width={20} height={20}><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></svg>
);
export const IconReverse = () => (
  <svg {...base} width={20} height={20}><path d="M7 4v16M7 4 3 8M7 4l4 4" /><path d="M17 20V4M17 20l-4-4M17 20l4-4" /></svg>
);
export const IconTrash = () => (
  <svg {...base} width={20} height={20}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
);
export const IconFit = () => (
  <svg {...base} width={20} height={20}><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
);
export const IconUp = () => (
  <svg {...base} width={18} height={18}><path d="m6 15 6-6 6 6" /></svg>
);
export const IconDown = () => (
  <svg {...base} width={18} height={18}><path d="m6 9 6 6 6-6" /></svg>
);
export const IconPlus = () => (
  <svg {...base} width={18} height={18}><path d="M12 5v14M5 12h14" /></svg>
);
