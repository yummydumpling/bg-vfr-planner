import { describe, expect, it } from 'vitest';
import { checkAgeLevel, dataAgeDays, dataAgeLevel, formatDataDate, relativeDays } from './dataAge';

const fetched = '2026-11-09T09:32:05.843Z';

describe('data age', () => {
  it('whole days since the snapshot', () => {
    expect(dataAgeDays(fetched, new Date('2026-11-09T20:00:00Z'))).toBe(0);
    expect(dataAgeDays(fetched, new Date('2026-11-15T12:00:00Z'))).toBe(6);
    expect(dataAgeDays(fetched, new Date('2026-11-01T00:00:00Z'))).toBe(0); // clock behind: never negative
  });
  it('levels follow the 28-day AIRAC cycle', () => {
    expect(dataAgeLevel(0)).toBe('fresh');
    expect(dataAgeLevel(28)).toBe('fresh');
    expect(dataAgeLevel(29)).toBe('aging');
    expect(dataAgeLevel(56)).toBe('aging');
    expect(dataAgeLevel(57)).toBe('outdated');
  });
  it('daily-check levels', () => {
    expect(checkAgeLevel(0)).toBe('fresh');
    expect(checkAgeLevel(3)).toBe('fresh');
    expect(checkAgeLevel(4)).toBe('aging');
    expect(checkAgeLevel(29)).toBe('outdated');
  });
  it('localised wording', () => {
    expect(relativeDays(0, 'en')).toBe('today');
    expect(relativeDays(6, 'en')).toBe('6 days ago');
    expect(relativeDays(6, 'bg')).toBe('преди 6 дни');
    expect(formatDataDate(fetched, 'en')).toBe('9 Nov 2026');
  });
});
