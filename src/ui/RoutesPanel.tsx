import { useCallback, useEffect, useRef, useState } from 'react';
import { deleteRoute, listRoutes, saveRoute, type SavedRoute } from '../db/routes';
import type { Route } from '../domain/types';
import { parseGpx, routeToGpx } from '../gpx/gpx';
import { gpxToWaypoints } from '../gpx/match';
import { useT } from '../i18n';
import { newId } from '../route/id';
import { summarizeLegs } from '../route/legs';
import { useData } from '../store/data';
import { useRoute } from '../store/route';
import { IconClose } from './icons';

const fileSafe = (s: string) => s.replace(/[^\p{L}\p{N}_-]+/gu, '_').replace(/^_+|_+$/g, '') || 'route';

/** Save a GPX file: share sheet with a file on phones, download elsewhere. */
async function deliverGpx(name: string, xml: string) {
  const fileName = `${fileSafe(name)}.gpx`;
  const file = new File([xml], fileName, { type: 'application/gpx+xml' });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: name });
      return;
    }
  } catch (e) {
    if ((e as DOMException)?.name === 'AbortError') return;
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function summary(r: Route) {
  const w = r.waypoints;
  const { totalNm } = summarizeLegs(w);
  return { path: w.length ? `${w[0].name} → ${w[w.length - 1].name}` : '—', nm: totalNm, n: w.length };
}

export function RoutesPanel({ onClose }: { onClose: () => void }) {
  const t = useT();
  const route = useRoute((s) => s.route);
  const { setName, loadRoute, newRoute } = useRoute.getState();
  const data = useData((s) => s.data);
  const [saved, setSaved] = useState<SavedRoute[]>([]);
  const [message, setMessage] = useState<{ text: string; bad?: boolean } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    try {
      setSaved(await listRoutes());
    } catch {
      setSaved([]);
    }
  }, []);
  useEffect(() => { void reload(); }, [reload]);

  const inLibrary = saved.find((r) => r.id === route.id);
  const dirty = !inLibrary ? route.waypoints.length > 0 : route.updatedAt > inLibrary.savedAt;
  const cur = summary(route);
  const displayName = (r: Route) => r.name.trim() || `${summary(r).path}`;

  const save = async (asCopy: boolean) => {
    const r: Route = asCopy ? { ...route, id: newId(), name: `${route.name || cur.path} (2)` } : route;
    const s = await saveRoute({ ...r, name: r.name.trim() || cur.path });
    if (asCopy) loadRoute(s);
    else if (!route.name.trim()) setName(s.name);
    setMessage({ text: `${t.savedOk}: ${s.name}` });
    await reload();
  };

  const open = (r: SavedRoute) => {
    if (dirty && route.id !== r.id && !window.confirm(t.confirmReplace)) return;
    loadRoute(r);
    onClose();
  };

  const startNew = () => {
    if (dirty && !window.confirm(t.confirmReplace)) return;
    newRoute();
    setMessage(null);
  };

  const importFile = async (file: File) => {
    try {
      const gpx = parseGpx(await file.text());
      if (dirty && !window.confirm(t.confirmReplace)) return;
      const wps = gpxToWaypoints(gpx.points, data);
      const recognised = wps.filter((w) => w.kind !== 'user').length;
      loadRoute({ id: newId(), name: gpx.name || file.name.replace(/\.gpx$/i, ''), waypoints: wps, updatedAt: new Date().toISOString() });
      setMessage({ text: `${t.importedN}: ${wps.length} · ${recognised} ${t.recognisedN}${gpx.source === 'trk' ? ` — ${t.gpxFromTrack}` : ''}` });
    } catch (e) {
      setMessage({ text: (e as Error).message === 'not-gpx' ? t.gpxNotGpx : t.gpxNoPoints, bad: true });
    }
  };

  return (
    <section className="fullsheet" aria-label={t.myRoutes}>
      <div className="panel-head sticky">
        <h2>{t.myRoutes}</h2>
        <button className="btn-icon" onClick={onClose} aria-label={t.close}><IconClose /></button>
      </div>
      <div className="pad lib">
        <h3>{t.currentRoute}</h3>
        <label className="field">
          <span className="field-label">{t.routeName}</span>
          <span className="field-input">
            <input value={route.name} placeholder={route.waypoints.length ? cur.path : t.untitled} onChange={(e) => setName(e.target.value)} />
          </span>
        </label>
        <p className="muted small">
          {cur.path} · {cur.nm.toFixed(1)} NM · {cur.n} {t.waypoints} ·{' '}
          {inLibrary ? (dirty ? <strong className="warn-text">{t.unsavedChanges}</strong> : `${t.savedOn} ${new Date(inLibrary.savedAt).toLocaleString()}`) : t.notSaved}
        </p>
        <div className="fpl-actions">
          <button className="btn-primary inline" onClick={() => void save(false)} disabled={!route.waypoints.length}>
            {inLibrary ? t.saveChanges : t.saveRoute}
          </button>
          {inLibrary && <button className="btn-secondary" onClick={() => void save(true)}>{t.saveCopy}</button>}
          <button className="btn-secondary" onClick={() => void deliverGpx(displayName(route), routeToGpx(displayName(route), route.waypoints))} disabled={route.waypoints.length < 2}>
            {t.exportGpx}
          </button>
          <button className="btn-secondary" onClick={() => fileRef.current?.click()}>{t.importGpx}</button>
          <button className="btn-secondary" onClick={startNew}>{t.newRoute}</button>
          <input ref={fileRef} type="file" accept=".gpx,application/gpx+xml,application/xml,text/xml" hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f); e.target.value = ''; }} />
        </div>
        {message && <p className={message.bad ? 'alert-soft' : 'ok-text'} role="status">{message.text}</p>}

        <h3>{t.myRoutes} ({saved.length})</h3>
        {saved.length === 0 && <p className="muted">{t.noSavedRoutes}</p>}
        <ul className="lib-list">
          {saved.map((r) => {
            const s = summary(r);
            return (
              <li key={r.id} className={r.id === route.id ? 'current' : undefined}>
                <button className="lib-main" onClick={() => open(r)}>
                  <span className="lib-name">{displayName(r)}</span>
                  <span className="muted small">{s.path} · {s.nm.toFixed(1)} NM · {s.n} {t.waypoints} · {new Date(r.savedAt).toLocaleDateString()}</span>
                </button>
                <div className="lib-btns">
                  <button className="btn-copy" onClick={() => void deliverGpx(displayName(r), routeToGpx(displayName(r), r.waypoints))}>GPX</button>
                  {confirmDelete === r.id ? (
                    <button className="btn-copy danger" onClick={async () => { await deleteRoute(r.id); setConfirmDelete(null); await reload(); }}>{t.deleteConfirm}</button>
                  ) : (
                    <button className="btn-icon xs danger" onClick={() => setConfirmDelete(r.id)} aria-label={t.delete}><IconClose /></button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <p className="muted small">{t.libraryNote}</p>
      </div>
    </section>
  );
}
