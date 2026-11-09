/**
 * Saved-route library in IndexedDB (via the small `idb` wrapper).
 * The working route lives in the route store; this is the user's library.
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Route } from '../domain/types';

interface BgVfrDB extends DBSchema {
  routes: {
    key: string;
    value: SavedRoute;
    indexes: { updatedAt: string };
  };
}

export interface SavedRoute extends Route {
  /** When it was last saved to the library. */
  savedAt: string;
}

const DB_NAME = 'bgvfr';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<BgVfrDB>> | null = null;
function db() {
  dbPromise ??= openDB<BgVfrDB>(DB_NAME, DB_VERSION, {
    upgrade(d) {
      // v1: routes. Later versions: track logs (in-flight mode), etc.
      const s = d.createObjectStore('routes', { keyPath: 'id' });
      s.createIndex('updatedAt', 'updatedAt');
    },
  });
  return dbPromise;
}

/** For tests: forget the cached connection. */
export const resetDbConnection = () => { dbPromise = null; };

export async function listRoutes(): Promise<SavedRoute[]> {
  const all = await (await db()).getAll('routes');
  return all.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export async function saveRoute(route: Route): Promise<SavedRoute> {
  const saved: SavedRoute = { ...structuredClone(route), savedAt: new Date().toISOString() };
  await (await db()).put('routes', saved);
  return saved;
}

export async function getRoute(id: string): Promise<SavedRoute | undefined> {
  return (await db()).get('routes', id);
}

export async function deleteRoute(id: string): Promise<void> {
  await (await db()).delete('routes', id);
}
