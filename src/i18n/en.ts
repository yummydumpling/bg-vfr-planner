export const en = {
  appName: 'BG VFR Planner',
  disclaimerShort: 'Supplementary tool only — not for primary navigation. Always verify with the official AIP, NOTAMs and briefing.',
  disclaimerTitle: 'Before you use this app',
  disclaimerBody:
    'BG VFR Planner is a supplementary planning aid. It is NOT approved for primary navigation and its data may be incomplete, outdated or wrong. ' +
    'Always verify routes, airspace, frequencies and aerodrome information against the official AIP Bulgaria, current NOTAMs, AUP/UUP and an official pre-flight briefing. ' +
    'The pilot in command remains solely responsible for the safe conduct of the flight.',
  disclaimerAccept: 'I understand',
  language: 'Language',
  theme: 'Theme',
  themeDark: 'Dark',
  themeLight: 'Light',
  layers: 'Layers',
  close: 'Close',
  loading: 'Loading aeronautical data…',
  loadError: 'Could not load aeronautical data.',
  dataSource: 'Aeronautical data',
  dataFetched: 'snapshot',
  about: 'Data & licences',

  // layer groups
  lyrControlled: 'Controlled airspace (CTR / TMA / CTA)',
  lyrAtz: 'Aerodrome zones (ATZ / MATZ / HTZ)',
  lyrRestricted: 'Prohibited / restricted / danger / TRA / TSA',
  lyrZones: 'TMZ / RMZ / gliding / sport',
  lyrFir: 'FIR boundaries',
  lyrOther: 'Other airspace (airways, ACC sectors…)',
  lyrAirports: 'Aerodromes & landing sites',
  lyrReporting: 'VFR reporting points',
  lyrNavaids: 'Navaids',

  // airport card
  elevation: 'Elevation',
  position: 'Position',
  magVar: 'Magnetic variation',
  runways: 'Runways',
  frequencies: 'Frequencies',
  noFrequencies: 'No frequencies in data',
  noRunways: 'No runway data',
  officialInfo: 'Official information',
  bflipLink: 'BULATSA B-FLIP aerodrome page',
  bflipNote: 'May require a free B-FLIP account.',
  aipLink: 'AIP Bulgaria (BULATSA)',
  verifyNote: 'Data from openAIP — verify against the official AIP.',
  ppr: 'PPR',
  private: 'Private',
  ifr: 'IFR',

  // airspace card
  airspacesHere: 'Airspace at this point',
  noAirspace: 'No airspace in the data at this point (class G).',
  byNotam: 'Activated by NOTAM',
  onRequest: 'On request',
  onDemand: 'On demand',
  activityNote: 'Check activation (AUP/UUP, NOTAM) before flight.',

  // point cards
  reportingPoint: 'VFR reporting point',
  compulsory: 'Compulsory',
  onRequestPoint: 'On request',
  forAerodromes: 'Aerodromes',
  navaid: 'Navaid',
  channel: 'Channel',
  frequency: 'Frequency',

  surface: {
    ASPHALT: 'Asphalt', CONCRETE: 'Concrete', GRASS: 'Grass', SAND: 'Sand', WATER: 'Water',
    GRAVEL: 'Gravel', EARTH: 'Earth', OTHER: 'Other', UNKNOWN: 'Unknown surface',
  },
  airportKind: {
    INTL: 'International airport', AIRPORT: 'Airport', AIRFIELD: 'Airfield', IFR_AIRFIELD: 'IFR aerodrome',
    GLIDER: 'Glider site', ULTRALIGHT: 'Ultralight site', HELI_CIVIL: 'Heliport', HELI_MIL: 'Military heliport',
    MILITARY: 'Military aerodrome', CLOSED: 'Closed aerodrome', WATER: 'Water aerodrome', STRIP: 'Landing strip',
    AGRI_STRIP: 'Agricultural strip', ALTIPORT: 'Altiport',
  },
} as const;

type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };
export type Dict = Widen<typeof en>;
