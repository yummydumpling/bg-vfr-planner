import { describe, expect, it } from 'vitest';
import type { Waypoint } from '../domain/types';
import {
  addWaypoint, makeWaypoint, moveWaypoint, removeWaypoint, renameWaypoint, reorderWaypoint,
  reverseRoute, userWaypoint,
} from './ops';

// distinct default positions so the "no zero-length leg" rule doesn't interfere
const wp = (id: string, lat = 42 + (id.charCodeAt(0) - 65) * 0.1, lon = 25): Waypoint => ({ id, lat, lon, name: id, kind: 'user' });
const ids = (l: Waypoint[]) => l.map((w) => w.id);

describe('route ops', () => {
  const base = [wp('A'), wp('B'), wp('C')];

  it('append and insert', () => {
    expect(ids(addWaypoint(base, wp('D')))).toEqual(['A', 'B', 'C', 'D']);
    expect(ids(addWaypoint(base, wp('X'), 1))).toEqual(['A', 'X', 'B', 'C']);
    expect(ids(addWaypoint(base, wp('Y'), 0))).toEqual(['Y', 'A', 'B', 'C']);
    expect(ids(addWaypoint(base, wp('Z'), 99))).toEqual(['A', 'B', 'C', 'Z']);
    expect(ids(base)).toEqual(['A', 'B', 'C']); // not mutated
  });

  it('remove', () => {
    expect(ids(removeWaypoint(base, 'B'))).toEqual(['A', 'C']);
    expect(removeWaypoint(base, 'nope')).toEqual(base);
  });

  it('reverse', () => {
    expect(ids(reverseRoute(base))).toEqual(['C', 'B', 'A']);
    expect(ids(base)).toEqual(['A', 'B', 'C']);
  });

  it('reorder', () => {
    expect(ids(reorderWaypoint(base, 0, 2))).toEqual(['B', 'C', 'A']);
    expect(ids(reorderWaypoint(base, 2, 0))).toEqual(['C', 'A', 'B']);
    expect(reorderWaypoint(base, 5, 0)).toBe(base);
  });

  it('move to free position becomes a user point named by coordinates', () => {
    const snapped = [{ ...wp('A'), kind: 'airport' as const, name: 'LBSF', refId: 'ap1' }];
    const moved = moveWaypoint(snapped, 'A', { lat: 42 + 41 / 60, lon: 23 + 23 / 60 });
    expect(moved[0]).toEqual({ id: 'A', lat: 42 + 41 / 60, lon: 23 + 23 / 60, kind: 'user', name: '4241N02323E' });
  });

  it('move with snap takes over the target identity but keeps the id', () => {
    const moved = moveWaypoint(base, 'B', { lat: 0, lon: 0 }, { lat: 42.7, lon: 23.4, name: 'LBSF', kind: 'airport', refId: 'ap1' });
    expect(moved[1]).toEqual({ id: 'B', lat: 42.7, lon: 23.4, name: 'LBSF', kind: 'airport', refId: 'ap1' });
  });

  it('rename ignores blank names', () => {
    expect(renameWaypoint(base, 'A', '  Home ')[0].name).toBe('Home');
    expect(renameWaypoint(base, 'A', '   ')).toBe(base);
  });

  it('makeWaypoint / userWaypoint assign unique ids', () => {
    const a = makeWaypoint({ lat: 1, lon: 2, name: 'x', kind: 'user' });
    const b = userWaypoint({ lat: 42.5, lon: 25.25 });
    expect(a.id).not.toBe(b.id);
    expect(b.name).toBe('4230N02515E');
    expect(makeWaypoint({ id: 'keep', lat: 1, lon: 2, name: 'x', kind: 'user' }).id).toBe('keep');
  });
});

describe('round trips', () => {
  it('appendCopyOf returns to the departure with a new id', async () => {
    const { appendCopyOf } = await import('./ops');
    const list = [{ ...wp('A', 42.69, 23.41), kind: 'airport' as const, name: 'LBSF', refId: 'ap1' }, wp('B', 42.5, 24)];
    const out = appendCopyOf(list, 'A');
    expect(out).toHaveLength(3);
    expect(out[2]).toMatchObject({ name: 'LBSF', kind: 'airport', refId: 'ap1', lat: 42.69, lon: 23.41 });
    expect(out[2].id).not.toBe('A');
  });
  it('no zero-length legs: same place next to itself is ignored', () => {
    const list = [wp('A', 42, 25), wp('B', 43, 25)];
    expect(addWaypoint(list, wp('C', 43, 25))).toBe(list);
    expect(addWaypoint(list, wp('D', 42, 25), 0)).toBe(list);
    expect(addWaypoint(list, wp('E', 42, 25))).toHaveLength(3); // back to A after B is fine
  });
});
