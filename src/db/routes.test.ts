import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { Route } from '../domain/types';
import { deleteRoute, getRoute, listRoutes, saveRoute } from './routes';

const route = (id: string, name: string): Route => ({
  id, name, cruiseAltFt: 3500, wind: { fromDeg: 270, speedKt: 10 }, alternates: ['LBPD'], updatedAt: '2026-11-09T10:00:00Z',
  waypoints: [
    { id: 'a', lat: 42.7, lon: 23.4, name: 'LBSF', kind: 'airport' },
    { id: 'b', lat: 42.07, lon: 24.85, name: 'LBPD', kind: 'airport' },
  ],
});

describe('route library (IndexedDB)', () => {
  it('saves, lists newest first, updates in place, loads and deletes', async () => {
    await saveRoute(route('r1', 'Training'));
    await new Promise((r) => setTimeout(r, 5));
    await saveRoute(route('r2', 'Coast'));
    let list = await listRoutes();
    expect(list.map((r) => r.name)).toEqual(['Coast', 'Training']);

    await new Promise((r) => setTimeout(r, 5));
    await saveRoute({ ...route('r1', 'Training v2') });
    list = await listRoutes();
    expect(list.map((r) => r.name)).toEqual(['Training v2', 'Coast']);
    expect(list).toHaveLength(2);

    const got = await getRoute('r2');
    expect(got?.waypoints.map((w) => w.name)).toEqual(['LBSF', 'LBPD']);
    expect(got?.wind).toEqual({ fromDeg: 270, speedKt: 10 });

    await deleteRoute('r2');
    expect((await listRoutes()).map((r) => r.id)).toEqual(['r1']);
  });
});
