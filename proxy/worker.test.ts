import { afterEach, describe, expect, it, vi } from 'vitest';
// @ts-expect-error plain-JS worker without type declarations
import worker, { corsHeaders, parseIds } from './worker.js';

const APP = 'https://yummydumpling.github.io';
const call = (path: string, init: RequestInit & { origin?: string } = {}) =>
  worker.fetch(new Request(`https://wx.example.workers.dev${path}`, { ...init, headers: init.origin ? { Origin: init.origin } : {} }), {}, {});

afterEach(() => vi.unstubAllGlobals());

describe('parseIds', () => {
  it('normalises and validates', () => {
    expect(parseIds('lbsf, LBPD')).toBe('LBPD,LBSF');
    expect(parseIds('LBSF,LBSF')).toBe('LBSF');
    expect(parseIds('LBS')).toBeNull();
    expect(parseIds('LBSF;DROP')).toBeNull();
    expect(parseIds('')).toBeNull();
    expect(parseIds(Array(13).fill('LBSF').map((x, i) => x.slice(0, 3) + String.fromCharCode(65 + i)).join(','))).toBeNull();
  });
  it('CORS only for the app', () => {
    expect(corsHeaders(APP)['Access-Control-Allow-Origin']).toBe(APP);
    expect(corsHeaders('https://evil.example')['Access-Control-Allow-Origin']).toBeUndefined();
  });
});

describe('worker', () => {
  it('forwards METAR requests with CORS and a User-Agent', async () => {
    const fetchMock = vi.fn(async () => new Response('[{"icaoId":"LBSF"}]', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const res = await call('/metar?ids=lbsf', { origin: APP });
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(APP);
    expect(await res.json()).toEqual([{ icaoId: 'LBSF' }]);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://aviationweather.gov/api/data/metar?ids=LBSF&format=json&hours=2');
    expect((init.headers as Record<string, string>)['User-Agent']).toMatch(/BG-VFR-Planner/);
  });
  it('maps "no data" (204) to an empty list', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })));
    const res = await call('/taf?ids=LBPG', { origin: APP });
    expect(await res.json()).toEqual([]);
  });
  it('rejects other paths, bad ids, foreign origins and methods', async () => {
    vi.stubGlobal('fetch', vi.fn());
    expect((await call('/pirep?ids=LBSF', { origin: APP })).status).toBe(404);
    expect((await call('/metar?ids=../../x', { origin: APP })).status).toBe(400);
    expect((await call('/metar?ids=LBSF', { origin: 'https://evil.example' })).status).toBe(403);
    expect((await call('/metar?ids=LBSF', { method: 'POST', origin: APP })).status).toBe(405);
    expect((await call('/metar?ids=LBSF', { method: 'OPTIONS', origin: APP })).status).toBe(204);
  });
  it('reports upstream failures as 502', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('busy', { status: 429 })));
    expect((await call('/metar?ids=LBSF', { origin: APP })).status).toBe(502);
  });
});
