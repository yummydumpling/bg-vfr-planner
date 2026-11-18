/**
 * Age of the bundled aeronautical data. Airspace changes are published on the
 * 28-day AIRAC cycle, so older than one cycle = check, older than two = outdated.
 */
export const AIRAC_DAYS = 28;

export type DataAgeLevel = 'fresh' | 'aging' | 'outdated';

export function dataAgeDays(fetchedAt: string, now = new Date()): number {
  const ms = now.getTime() - new Date(fetchedAt).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

export function dataAgeLevel(days: number): DataAgeLevel {
  return days <= AIRAC_DAYS ? 'fresh' : days <= 2 * AIRAC_DAYS ? 'aging' : 'outdated';
}

/**
 * With a daily automatic check, freshness depends on when the data was last
 * *checked*: a missed check or two is fine, a week means the job is broken.
 */
export function checkAgeLevel(daysSinceCheck: number): DataAgeLevel {
  return daysSinceCheck <= 3 ? 'fresh' : daysSinceCheck <= AIRAC_DAYS ? 'aging' : 'outdated';
}

/** "today", "yesterday", "6 days ago" / "днес", "вчера", "преди 6 дни". */
export function relativeDays(days: number, lang: string): string {
  try {
    return new Intl.RelativeTimeFormat(lang, { numeric: 'auto' }).format(-days, 'day');
  } catch {
    return `${days} d`;
  }
}

/** "9 Nov 2026" / "9.11.2026 г." in the UI language. */
export function formatDataDate(fetchedAt: string, lang: string): string {
  try {
    // European day-month order for English too
    const locale = lang === 'en' ? 'en-GB' : lang;
    return new Date(fetchedAt).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return fetchedAt.slice(0, 10);
  }
}
