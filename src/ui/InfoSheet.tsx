import { useMemo, useState } from 'react';
import { airspaceBadge, formatLimit, formatVariation, pairRunways } from '../domain/format';
import type { Airport, AirspaceProps, Navaid, ReportingPoint } from '../domain/types';
import { useT } from '../i18n';
import type { Dict } from '../i18n/en';
import { zoomToAirspace } from '../map/focus';
import { formatDMS } from '../nav/coords';
import { magneticVariation } from '../nav/magvar/wmm';
import { waypointFromFeature, type PointKind } from '../route/fromData';
import { makeWaypoint } from '../route/ops';
import { useData } from '../store/data';
import { useRoute } from '../store/route';
import { IconClose, IconExternal, IconPlus } from './icons';

/** Append this aerodrome / point / navaid to the working route. */
function AddToRoute({ kind, id, t }: { kind: PointKind; id: string; t: Dict }) {
  const data = useData((s) => s.data);
  const [addedAs, setAddedAs] = useState<number | null>(null);
  const add = () => {
    if (!data) return;
    const wp = waypointFromFeature(data, kind, id);
    if (!wp) return;
    const route = useRoute.getState();
    route.add(makeWaypoint(wp));
    setAddedAs(useRoute.getState().route.waypoints.length);
  };
  return (
    <div className="add-to-route">
      <button className="btn-secondary" onClick={add}>
        <IconPlus /> {t.addToRoute}
      </button>
      {addedAs != null && <span className="muted small" role="status">{t.addedToRoute} {addedAs}</span>}
    </div>
  );
}

export function InfoSheet() {
  const t = useT();
  const data = useData((s) => s.data);
  const selection = useData((s) => s.selection);
  const select = useData((s) => s.select);

  const index = useMemo(() => {
    if (!data) return null;
    return {
      airports: new Map(data.airports.map((a) => [a.id, a])),
      rps: new Map(data.reportingPoints.map((p) => [p.id, p])),
      navaids: new Map(data.navaids.map((n) => [n.id, n])),
      airspaces: new Map(data.airspaces.features.map((f) => [f.properties.id, f.properties])),
    };
  }, [data]);

  if (!selection || !index) return null;

  let body: React.ReactNode = null;
  if (selection.kind === 'airport') {
    const a = index.airports.get(selection.id);
    if (a) body = <><AirportCard a={a} t={t} /><AddToRoute key={a.id} kind="airport" id={a.id} t={t} /></>;
  } else if (selection.kind === 'reporting') {
    const p = index.rps.get(selection.id);
    if (p) body = <><ReportingCard p={p} t={t} /><AddToRoute key={p.id} kind="reporting" id={p.id} t={t} /></>;
  } else if (selection.kind === 'navaid') {
    const n = index.navaids.get(selection.id);
    if (n) body = <><NavaidCard n={n} t={t} /><AddToRoute key={n.id} kind="navaid" id={n.id} t={t} /></>;
  } else {
    const list = selection.ids.map((id) => index.airspaces.get(id)).filter((x): x is AirspaceProps => !!x);
    body = <AirspaceList list={list} lat={selection.lat} lon={selection.lon} focusId={selection.focusId} t={t} />;
  }

  return (
    <section className="sheet" aria-live="polite">
      <button className="btn-icon sheet-close" onClick={() => select(null)} aria-label={t.close}>
        <IconClose />
      </button>
      <div className="sheet-body">{body}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="kv">
      <span className="k">{label}</span>
      <span className="v">{children}</span>
    </div>
  );
}

function AirportCard({ a, t }: { a: Airport; t: Dict }) {
  const variation = magneticVariation(a.lat, a.lon);
  const runways = pairRunways(a.runways);
  const isBg = a.icao?.startsWith('LB');
  return (
    <article>
      <header className="card-head">
        <h2>
          {a.icao && <span className="ident">{a.icao}</span>} {a.name}
        </h2>
        <div className="badges">
          <span className="badge">{t.airportKind[a.kind]}</span>
          {a.ifr && <span className="badge">{t.ifr}</span>}
          {a.ppr && <span className="badge warn">{t.ppr}</span>}
          {a.private && <span className="badge warn">{t.private}</span>}
        </div>
      </header>
      <Row label={t.elevation}>{a.elevationFt} ft ({Math.round(a.elevationFt * 0.3048)} m)</Row>
      <Row label={t.position}><span className="mono">{formatDMS(a.lat, a.lon)}</span></Row>
      <Row label={t.magVar}>{formatVariation(variation)} <small>(WMM2025)</small></Row>

      <h3>{t.runways}</h3>
      {runways.length ? (
        <table className="tbl">
          <tbody>
            {runways.map((r) => (
              <tr key={r.designators}>
                <td className="mono strong">{r.designators}</td>
                <td>{r.lengthM ? `${r.lengthM}${r.widthM ? ` × ${r.widthM}` : ''} m` : '—'}</td>
                <td>{t.surface[r.surface]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <p className="muted">{t.noRunways}</p>}

      <h3>{t.frequencies}</h3>
      {a.frequencies.length ? (
        <table className="tbl">
          <tbody>
            {a.frequencies.map((f, i) => (
              <tr key={i} className={f.primary ? 'strong' : undefined}>
                <td>{f.type}</td>
                <td>{f.name}</td>
                <td className="mono">{f.mhz}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <p className="muted">{t.noFrequencies}</p>}

      <h3>{t.officialInfo}</h3>
      <ul className="links">
        {isBg && (
          <li>
            <a href={`https://b-flip.bulatsa.com/airports/${a.icao}/general`} target="_blank" rel="noopener">
              {t.bflipLink} <IconExternal />
            </a>
            <div className="muted small">{t.bflipNote}</div>
          </li>
        )}
        <li>
          <a href="https://b-flip.bulatsa.com" target="_blank" rel="noopener">{t.aipLink} <IconExternal /></a>
        </li>
      </ul>
      <p className="muted small">{t.verifyNote}</p>
    </article>
  );
}

function AirspaceList({ list, lat, lon, focusId, t }: { list: AirspaceProps[]; lat: number; lon: number; focusId?: string; t: Dict }) {
  const focus = useData((s) => s.focusAirspace);
  const data = useData((s) => s.data);
  return (
    <article>
      <header className="card-head">
        <h2>{t.airspacesHere}</h2>
        <div className="muted small mono">{formatDMS(lat, lon)}</div>
      </header>
      {list.length === 0 && <p>{t.noAirspace}</p>}
      {list.length > 1 && <p className="muted small">{t.tapToShowAirspace}</p>}
      <ul className="as-list">
        {list.map((a) => (
          <li
            key={a.id}
            className={`as-item ck-${a.type}${a.id === focusId ? ' focused' : ''}`}
            role="button"
            tabIndex={0}
            aria-pressed={a.id === focusId}
            onClick={() => { focus(a.id); if (data) zoomToAirspace(data.airspaces, a.id); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { focus(a.id); if (data) zoomToAirspace(data.airspaces, a.id); } }}
          >
            <div className="as-limits mono">
              <span>{formatLimit(a.upper)}</span>
              <span className="as-rule" />
              <span>{formatLimit(a.lower)}</span>
            </div>
            <div className="as-main">
              <div className="as-name">{a.name}</div>
              <div className="badges">
                <span className="badge">{airspaceBadge(a.type, a.cls)}</span>
                {a.byNotam && <span className="badge warn">{t.byNotam}</span>}
                {a.onRequest && <span className="badge">{t.onRequest}</span>}
                {a.onDemand && <span className="badge">{t.onDemand}</span>}
                {a.country !== 'BG' && <span className="badge">{a.country}</span>}
              </div>
            </div>
          </li>
        ))}
      </ul>
      {list.some((a) => ['D', 'R', 'TRA', 'TSA', 'MTA'].includes(a.type)) && (
        <p className="muted small">{t.activityNote}</p>
      )}
      <p className="muted small">{t.verifyNote}</p>
    </article>
  );
}

function ReportingCard({ p, t }: { p: ReportingPoint; t: Dict }) {
  return (
    <article>
      <header className="card-head">
        <h2><span className="ident">{p.name}</span></h2>
        <div className="badges">
          <span className="badge">{t.reportingPoint}</span>
          <span className="badge">{p.compulsory ? t.compulsory : t.onRequestPoint}</span>
        </div>
      </header>
      <Row label={t.position}><span className="mono">{formatDMS(p.lat, p.lon)}</span></Row>
      {p.airports.length > 0 && <Row label={t.forAerodromes}>{p.airports.join(', ')}</Row>}
      <p className="muted small">{t.verifyNote}</p>
    </article>
  );
}

function NavaidCard({ n, t }: { n: Navaid; t: Dict }) {
  return (
    <article>
      <header className="card-head">
        <h2><span className="ident">{n.ident}</span> {n.name}</h2>
        <div className="badges"><span className="badge">{n.kind}</span></div>
      </header>
      <Row label={t.frequency}><span className="mono">{n.frequency} {n.frequencyUnit}</span></Row>
      {n.channel && <Row label={t.channel}><span className="mono">{n.channel}</span></Row>}
      <Row label={t.position}><span className="mono">{formatDMS(n.lat, n.lon)}</span></Row>
      {n.elevationFt != null && <Row label={t.elevation}>{n.elevationFt} ft</Row>}
      <p className="muted small">{t.verifyNote}</p>
    </article>
  );
}
