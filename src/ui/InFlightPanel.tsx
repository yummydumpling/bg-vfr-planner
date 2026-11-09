import { useEffect, useMemo, useRef, useState } from 'react';
import { crossingSeverity, routeCrossings, assessVertical } from '../airspace/crossings';
import { airspacesAt } from '../airspace/query';
import { airspaceBadge, formatLimit } from '../domain/format';
import { useT } from '../i18n';
import { navState, type Fix } from '../inflight/navigation';
import { destinationPoint } from '../nav/geo';
import { formatTrack } from '../route/legs';
import { useData } from '../store/data';
import { useInflight } from '../store/inflight';
import { useRoute } from '../store/route';
import { IconClose, IconPlane } from './icons';

const LOOKAHEAD_NM = 10;
const M_TO_FT = 3.28084;

const hhmmZ = (d: Date | null) =>
  d ? `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}Z` : '--:--';
const mmss = (min: number | null) => {
  if (min == null || !Number.isFinite(min)) return '--:--';
  const s = Math.round(min * 60);
  return s >= 3600 ? `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}h`
    : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

function Box({ label, value, unit, wide, warn }: { label: string; value: string; unit?: string; wide?: boolean; warn?: boolean }) {
  return (
    <div className={`if-box${wide ? ' wide' : ''}${warn ? ' warn' : ''}${value.length > 6 ? ' long' : ''}`}>
      <span className="if-label">{label}</span>
      <span className="if-value">{value}{unit && <small>{unit}</small>}</span>
    </div>
  );
}

/** "Inside now" and the next relevant airspace along the current track. */
function useAirspaceAwareness(fix: Fix | null, fallbackAltFt: number) {
  const data = useData((s) => s.data);
  return useMemo(() => {
    if (!fix || !data) return null;
    const altFt = fix.altM != null ? fix.altM * M_TO_FT : fallbackAltFt;
    const inside = airspacesAt(data.airspaces, fix, (cat) => cat !== 'other')
      .filter((a) => { const v = assessVertical(altFt, a.lower, a.upper); return v.status === 'inside' || v.status === 'check'; });
    let ahead = null;
    if (fix.trackTrue != null && (fix.speedKt ?? 0) >= 20) {
      const end = destinationPoint(fix, fix.trackTrue, LOOKAHEAD_NM);
      ahead = routeCrossings(data.airspaces, [fix, end], altFt, { stepNm: 0.25 })
        .filter((c) => c.entryNm > 0.05 && crossingSeverity(c) !== 'none' && !inside.some((a) => a.id === c.airspace.id))[0] ?? null;
    }
    return { inside, ahead, altFt };
  }, [fix, data, fallbackAltFt]);
}

export function InFlightPanel() {
  const t = useT();
  const { active, mode, status, fix, activeLeg, follow, setFollow, nextLeg, prevLeg, stop } = useInflight();
  const route = useRoute((s) => s.route);
  const wps = route.waypoints;
  const nav = useMemo(() => (fix && wps.length >= 2 ? navState(wps, activeLeg, fix) : null), [fix, wps, activeLeg]);
  const aware = useAirspaceAwareness(fix, route.cruiseAltFt);
  const topRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = topRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => document.documentElement.style.setProperty('--if-top-h', `${el.offsetHeight + 8}px`));
    ro.observe(el);
    return () => ro.disconnect();
  }, [active]);
  if (!active) return null;

  const statusMsg =
    status === 'denied' ? t.gpsDenied : status === 'unavailable' ? t.gpsUnavailable : status === 'timeout' ? t.gpsTimeout : null;
  const lost = status === 'lost';
  const xte = nav ? Math.abs(nav.xteNm) : 0;

  return (
    <>
      <section className="if-top" aria-label={t.flyTitle} ref={topRef}>
        <div className="if-grid">
          <Box label={t.ifGs} value={fix?.speedKt != null ? String(Math.round(fix.speedKt)) : '---'} unit="kt" />
          <Box label={t.ifTrk} value={nav?.trkMag != null ? formatTrack(nav.trkMag) : fix?.trackTrue != null ? formatTrack(fix.trackTrue) : '---'} unit={nav?.trkMag != null ? 'M' : 'T'} />
          <Box label={`${t.ifAlt} GPS`} value={fix?.altM != null ? String(Math.round((fix.altM * M_TO_FT) / 10) * 10) : '---'} unit="ft" />
          {nav && (
            <>
              <Box label={t.ifNext} value={nav.to.name} wide />
              <Box label={t.ifBrg} value={formatTrack(nav.brgMag)} unit="M" />
              <Box label={t.ifDist} value={nav.distToNm.toFixed(nav.distToNm < 10 ? 1 : 0)} unit="NM" />
              <Box label={t.ifEte} value={mmss(nav.eteMin)} />
              <Box label={t.ifXte} value={`${xte.toFixed(xte < 10 ? 1 : 0)} ${nav.xteNm >= 0 ? t.right : t.left}`} unit="NM" warn={xte >= 1} />
              <Box label={`${t.ifEtaDest} · ${nav.distDestNm.toFixed(0)} NM`} value={hhmmZ(nav.etaDest)} />
            </>
          )}
        </div>
        <div className="if-meta">
          <span className={`if-chip${mode === 'sim' ? ' sim' : lost ? ' bad' : ''}`}>
            {mode === 'sim' ? t.simBadge : fix ? `GPS ±${Math.round(fix.accuracyM)} m` : 'GPS'}
          </span>
        {aware && (aware.inside.length > 0 || aware.ahead) && (
          <div className="if-airspace">
            {aware.inside.length > 0 && (
              <span><strong>{t.insideNow}:</strong> {aware.inside.map((a) => airspaceBadge(a.type, a.cls) === a.type ? a.name : `${a.name} (${a.cls})`).join(' · ')}</span>
            )}
            {aware.ahead && (
              <span className={`sev-${crossingSeverity(aware.ahead)}`}>
                <strong>{t.aheadIn} {aware.ahead.entryNm.toFixed(1)} NM{fix?.speedKt ? ` · ${mmss((aware.ahead.entryNm / fix.speedKt) * 60)}` : ''}:</strong>{' '}
                {aware.ahead.airspace.name} {formatLimit(aware.ahead.airspace.lower)}–{formatLimit(aware.ahead.airspace.upper)}
              </span>
            )}
          </div>
        )}
        </div>
        {(status === 'acquiring' || lost || statusMsg) && (
          <div className={`if-status${lost || statusMsg ? ' bad' : ''}`}>{statusMsg ?? (lost ? t.gpsLost : t.gpsAcquiring)}</div>
        )}
        {nav?.arrived && <div className="if-status good">{t.arrived}: {nav.to.name}</div>}
      </section>

      <section className="if-bottom">
        {wps.length >= 2 && (
          <>
            <button className="btn-icon sm" onClick={prevLeg} disabled={activeLeg === 0} aria-label="Previous waypoint">◀</button>
            <span className="if-leg">→ {wps[Math.min(activeLeg + 1, wps.length - 1)].name} <small>{t.legOf} {activeLeg + 1}/{wps.length - 1}</small></span>
            <button className="btn-icon sm" onClick={nextLeg} disabled={activeLeg >= wps.length - 2} aria-label="Next waypoint">▶</button>
          </>
        )}
        <span className="spacer" />
        <button className={`btn-copy${follow ? ' on' : ''}`} onClick={() => setFollow(!follow)} aria-pressed={follow}>{t.follow}</button>
        <button className="btn-stop" onClick={stop}>{t.stopFlight}</button>
      </section>
    </>
  );
}

/** "Fly" button and the start sheet. */
export function FlyButton() {
  const t = useT();
  const active = useInflight((s) => s.active);
  const start = useInflight((s) => s.start);
  const planning = useRoute((s) => s.planning);
  const setPlanning = useRoute((s) => s.setPlanning);
  const nWps = useRoute((s) => s.route.waypoints.length);
  const [open, setOpen] = useState(false);
  if (active || planning) return null;
  const go = (mode: 'gps' | 'sim') => {
    setOpen(false);
    setPlanning(false);
    start(mode);
  };
  return (
    <>
      <button className="fab fab-fly" onClick={() => setOpen(true)} aria-label={t.flyTitle}>
        <IconPlane /> <span>{t.fly}</span>
      </button>
      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="fly-title" onClick={(e) => e.stopPropagation()}>
            <div className="panel-head">
              <h2 id="fly-title">{t.flyTitle}</h2>
              <button className="btn-icon" onClick={() => setOpen(false)} aria-label={t.close}><IconClose /></button>
            </div>
            <button className="btn-primary" onClick={() => go('gps')}>{t.startGps}</button>
            <button className="btn-secondary block" onClick={() => go('sim')} disabled={nWps < 2}>{t.simulate}</button>
            {nWps < 2 && <p className="muted small">{t.noRouteFly}</p>}
            <p className="muted small">{t.flyNote}</p>
          </div>
        </div>
      )}
    </>
  );
}
