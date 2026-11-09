import { useMemo, useState } from 'react';
import { crossingSeverity, routeCrossings, type Crossing } from '../airspace/crossings';
import { airspaceBadge, formatLimit } from '../domain/format';
import type { Route } from '../domain/types';
import { useT } from '../i18n';
import type { Dict } from '../i18n/en';
import { zoomToAirspace } from '../map/focus';
import { useData } from '../store/data';

function statusText(c: Crossing, t: Dict) {
  switch (c.vertical.status) {
    case 'inside': return t.stInside;
    case 'below': return t.stBelow;
    case 'above': return t.stAbove;
    default: return t.stCheck;
  }
}

/** Airspaces entered by the route, compared with the planned cruise altitude. */
export function CrossingList({ route, onShowOnMap }: { route: Route; onShowOnMap: () => void }) {
  const t = useT();
  const data = useData((s) => s.data);
  const select = useData((s) => s.select);
  const [onlyRelevant, setOnlyRelevant] = useState(true);

  const crossings = useMemo(
    () => (data && Number.isFinite(route.cruiseAltFt) ? routeCrossings(data.airspaces, route.waypoints, route.cruiseAltFt) : []),
    [data, route.waypoints, route.cruiseAltFt],
  );
  const relevant = crossings.filter((c) => crossingSeverity(c) !== 'none');
  const shown = onlyRelevant ? relevant : crossings;

  const show = (c: Crossing) => {
    if (!data) return;
    select({ kind: 'airspaces', lat: c.entryPoint.lat, lon: c.entryPoint.lon, ids: [c.airspace.id], focusId: c.airspace.id });
    onShowOnMap();
    // wait for the panel to close before moving the camera
    requestAnimationFrame(() => zoomToAirspace(data.airspaces, c.airspace.id));
  };

  return (
    <section className="crossings">
      <h3>
        {t.airspaceOnRoute} <span className="muted">({t.atCruise} {route.cruiseAltFt} ft)</span>
      </h3>
      <label className="check-row">
        <input type="checkbox" checked={onlyRelevant} onChange={() => setOnlyRelevant((v) => !v)} />
        <span>{t.onlyRelevant}</span>
        {onlyRelevant && crossings.length > relevant.length && (
          <span className="muted small">(+{crossings.length - relevant.length} {t.hiddenCount})</span>
        )}
      </label>

      {crossings.length === 0 && <p className="muted">{t.noCrossings}</p>}
      {crossings.length > 0 && shown.length === 0 && <p className="muted">{t.noRelevant}</p>}

      <ul className="cx-list">
        {shown.map((c, i) => {
          const sev = crossingSeverity(c);
          return (
            <li key={`${c.airspace.id}-${i}`} className={`cx-item sev-${sev} ck-${c.airspace.type}`}>
              <button className="cx-btn" onClick={() => show(c)} title={t.showOnMap}>
                <span className="cx-dist mono">
                  {c.entryNm.toFixed(1)}–{c.exitNm.toFixed(1)}
                  <small>NM · {t.legShort} {c.entryLeg + 1}</small>
                </span>
                <span className="cx-main">
                  <span className="cx-name">{c.airspace.name}</span>
                  <span className="badges">
                    <span className="badge">{airspaceBadge(c.airspace.type, c.airspace.cls)}</span>
                    <span className={`badge st-${c.vertical.status}`}>{statusText(c, t)}</span>
                    {c.vertical.marginal && <span className="badge warn">{t.stMarginal}</span>}
                    {c.atDeparture && <span className="badge">{t.atDep}</span>}
                    {c.atDestination && <span className="badge">{t.atDest}</span>}
                    {c.airspace.byNotam && <span className="badge warn">{t.byNotam}</span>}
                  </span>
                </span>
                <span className="cx-limits mono">
                  <span>{formatLimit(c.airspace.upper)}</span>
                  <span className="as-rule" />
                  <span>{formatLimit(c.airspace.lower)}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="muted small">{t.crossingsNote}</p>
    </section>
  );
}
