import { useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../i18n';
import { getMapInstance } from '../map/mapInstance';
import { formatTrack, summarizeLegs } from '../route/legs';
import { useRoute } from '../store/route';
import { IconClose, IconDown, IconFit, IconReverse, IconRoute, IconTrash, IconUndo, IconUp } from './icons';

/** Zoom the map to the whole route. */
function fitRoute() {
  const map = getMapInstance();
  const wps = useRoute.getState().route.waypoints;
  if (!map || !wps.length) return;
  if (wps.length === 1) {
    map.easeTo({ center: [wps[0].lon, wps[0].lat], zoom: Math.max(map.getZoom(), 9) });
    return;
  }
  const lons = wps.map((w) => w.lon);
  const lats = wps.map((w) => w.lat);
  map.fitBounds([[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]], {
    padding: { top: 60, bottom: Math.round(window.innerHeight * 0.45), left: 40, right: 60 },
    maxZoom: 11,
  });
}

/** Floating button that toggles planning mode. */
export function RouteButton() {
  const t = useT();
  const planning = useRoute((s) => s.planning);
  const count = useRoute((s) => s.route.waypoints.length);
  const setPlanning = useRoute((s) => s.setPlanning);
  if (planning) return null;
  return (
    <button className="fab" onClick={() => setPlanning(true)} aria-label={t.planRoute}>
      <IconRoute />
      <span>{count ? `${t.route} (${count})` : t.planRoute}</span>
    </button>
  );
}

export function RoutePanel({ onNavLog }: { onNavLog: () => void }) {
  const t = useT();
  const { route, planning, selectedWp, past } = useRoute();
  const { setPlanning, selectWp, remove, reorder, reverse, clear, undo, appendCopy } = useRoute.getState();
  const [expanded, setExpanded] = useState(true);
  const wps = route.waypoints;
  const { legs, totalNm } = useMemo(() => summarizeLegs(wps), [wps]);
  const listRef = useRef<HTMLOListElement>(null);

  // Keep the selected waypoint visible in the list
  useEffect(() => {
    if (!selectedWp || !listRef.current) return;
    listRef.current.querySelector(`[data-wp="${selectedWp}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedWp, wps.length]);

  if (!planning) return null;

  return (
    <section className={`route-panel${expanded ? '' : ' collapsed'}`} aria-label={t.route}>
      <header className="route-head">
        <button className="route-title" onClick={() => setExpanded((e) => !e)} aria-expanded={expanded} title={expanded ? t.collapse : t.expand}>
          <strong>{t.route}</strong>
          <span className="muted">
            {wps.length} {t.waypoints}
            {legs.length > 0 && <> · <span className="mono">{totalNm.toFixed(1)} NM</span></>}
          </span>
        </button>
        <div className="route-actions">
          <button className="btn-icon sm" onClick={undo} disabled={!past.length} aria-label={t.undo} title={t.undo}><IconUndo /></button>
          <button className="btn-icon sm" onClick={reverse} disabled={wps.length < 2} aria-label={t.reverse} title={t.reverse}><IconReverse /></button>
          <button className="btn-icon sm" onClick={fitRoute} disabled={!wps.length} aria-label={t.fitRoute} title={t.fitRoute}><IconFit /></button>
          <button className="btn-icon sm" onClick={clear} disabled={!wps.length} aria-label={t.clear} title={t.clear}><IconTrash /></button>
          <button className="btn-done" onClick={() => { setPlanning(false); selectWp(null); }}>{t.done}</button>
        </div>
      </header>

      {expanded && (
        <>
          {wps.length < 2 && (
            <div className="route-hint">
              <strong>{t.routeHintTitle}</strong>
              <p>{t.routeHint}</p>
            </div>
          )}
          {legs.length > 0 && (
            <div className="route-links">
              <button className="navlog-link" onClick={onNavLog}>{t.navlog} →</button>
              {wps[wps.length - 1].name !== wps[0].name && (
                <button className="navlog-link" onClick={() => appendCopy(wps[0].id)}>↩ {t.backTo} {wps[0].name}</button>
              )}
            </div>
          )}
          <ol className="wp-list" ref={listRef}>
            {wps.map((w, i) => {
              const leg = legs[i];
              return (
                <li key={w.id} data-wp={w.id} className={w.id === selectedWp ? 'selected' : undefined}>
                  <div className="wp-row" onClick={() => selectWp(w.id)}>
                    <span className={`wp-num${i === 0 ? ' first' : i === wps.length - 1 ? ' last' : ''}`}>{i + 1}</span>
                    <span className="wp-name">
                      <span className={w.kind === 'user' ? 'mono' : 'strong'}>{w.name}</span>
                      <span className="muted small">{t.wpKind[w.kind]}</span>
                    </span>
                    <span className="wp-btns">
                      <button className="btn-icon xs" onClick={(e) => { e.stopPropagation(); reorder(i, i - 1); }} disabled={i === 0} aria-label={t.moveUp}><IconUp /></button>
                      <button className="btn-icon xs" onClick={(e) => { e.stopPropagation(); reorder(i, i + 1); }} disabled={i === wps.length - 1} aria-label={t.moveDown}><IconDown /></button>
                      <button className="btn-icon xs danger" onClick={(e) => { e.stopPropagation(); remove(w.id); }} aria-label={t.deleteWp}><IconClose /></button>
                    </span>
                  </div>
                  {leg && (
                    <div className="leg-row mono">
                      <span>↓ {formatTrack(leg.magTrack)}M</span>
                      <span>{leg.distanceNm.toFixed(1)} NM</span>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </>
      )}
    </section>
  );
}
