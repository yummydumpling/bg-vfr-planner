import { describe, expect, it } from 'vitest';
import { CHANGELOG, compareVersions, notesSince } from './changelog';

describe('changelog', () => {
  it('compares versions, ignoring build metadata', () => {
    expect(compareVersions('1.1.0+abc', '1.0.9')).toBeGreaterThan(0);
    expect(compareVersions('0.9.1', '0.10.0')).toBeLessThan(0);
    expect(compareVersions('1.0.0+x', '1.0.0+y')).toBe(0);
  });
  it('shows only notes newer than the last seen version', () => {
    expect(notesSince(null, '1.1.0')).toEqual([]); // first install: nothing
    expect(notesSince('1.1.0+a', '1.1.0+b')).toEqual([]);
    expect(notesSince('0.9.1+a', '1.1.0+b').map((n) => n.version)).toEqual(['1.1.0', '1.0.0']);
  });
  it('every entry has text in both languages, newest first', () => {
    for (const n of CHANGELOG) expect(n.bg.length && n.bg.length === n.en.length).toBeTruthy();
    for (let i = 1; i < CHANGELOG.length; i++) expect(compareVersions(CHANGELOG[i - 1].version, CHANGELOG[i].version)).toBeGreaterThan(0);
  });
});
