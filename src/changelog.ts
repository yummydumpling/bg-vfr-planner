/** User-facing release notes (newest first). Shown once after an update. */
export interface ReleaseNote {
  version: string;
  date: string;
  bg: string[];
  en: string[];
}

export const CHANGELOG: ReleaseNote[] = [
  {
    version: '1.1.0',
    date: '2026-11-18',
    bg: [
      'Данните за въздушното пространство се проверяват автоматично всеки ден — етикетът на картата показва кога са променени и кога са проверени.',
      'Поверителност и условия за ползване (в „Слоеве“ → „Данни и лицензи“).',
      'Бутон „Обратна връзка“ и екран за грешка с „Изпрати доклад“.',
      'Този списък „Какво ново“ след всяко обновяване.',
    ],
    en: [
      'Airspace data is now checked automatically every day — the map label shows when it last changed and when it was checked.',
      'Privacy notice and terms of use (Layers → Data & licences).',
      'Feedback button, and an error screen with "Send report".',
      'This "What\'s new" list after every update.',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-11-18',
    bg: ['Автор и лиценз, бутон „Сподели приложението“, преглед на линка в Messenger/Facebook.'],
    en: ['Author credit and licence, "Share the app" button, link preview for Messenger/Facebook.'],
  },
  {
    version: '0.9.0',
    date: '2026-11-09',
    bg: ['Режим „Полет“ с GPS, симулатор и предупреждения за въздушно пространство напред.', 'Етикет с възрастта на данните на картата.'],
    en: ['In-flight mode with GPS, simulator and airspace-ahead warnings.', 'Data-age label on the map.'],
  },
];

/** "1.1.0+abc123" → [1, 1, 0] */
export function parseVersion(v: string): number[] {
  return v.split('+')[0].split('.').map((x) => parseInt(x, 10) || 0);
}

export function compareVersions(a: string, b: string): number {
  const [x, y] = [parseVersion(a), parseVersion(b)];
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
  return 0;
}

/** Notes newer than the last version the user has seen. */
export function notesSince(lastSeen: string | null, current: string): ReleaseNote[] {
  if (!lastSeen) return [];
  return CHANGELOG.filter((n) => compareVersions(n.version, lastSeen) > 0 && compareVersions(n.version, current) <= 0);
}
