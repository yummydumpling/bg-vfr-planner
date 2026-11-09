import { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { crossingSeverity, routeCrossings } from '../airspace/crossings';
import { airspaceBadge, formatLimit } from '../domain/format';
import { buildFields, buildFplMessage } from '../fpl/fpl';
import { fplInputFrom } from '../fpl/fromState';
import { buildNavLog, formatFuel, formatVarShort, formatWca } from '../flight/plan';
import { useT } from '../i18n';
import { formatDuration } from '../nav/navlog';
import { formatTrack } from '../route/legs';
import { useSelectedAircraft } from '../store/aircraft';
import { useData } from '../store/data';
import { useFlightPlan } from '../store/flightPlan';
import { useRoute } from '../store/route';

const trk = (v: number | null) => (v == null ? '—' : formatTrack(v));

/** Print-only document (A4): flight plan, nav log, fuel and airspace. Hidden on screen. */
export function PrintView() {
  const t = useT();
  const route = useRoute((s) => s.route);
  const aircraft = useSelectedAircraft();
  const { pilot, draft } = useFlightPlan();
  const data = useData((s) => s.data);
  const log = useMemo(() => (route.waypoints.length >= 2 ? buildNavLog(route, aircraft) : null), [route, aircraft]);
  const input = fplInputFrom(route, aircraft, pilot, draft, log);
  const fields = buildFields(input);
  const crossings = useMemo(
    () => (data ? routeCrossings(data.airspaces, route.waypoints, route.cruiseAltFt).filter((c) => crossingSeverity(c) !== 'none') : []),
    [data, route.waypoints, route.cruiseAltFt],
  );
  const u = aircraft.fuelUnit;
  const first = route.waypoints[0]?.name ?? '';
  const last = route.waypoints[route.waypoints.length - 1]?.name ?? '';

  return createPortal(
    <div className="print-root">
      <header className="pr-head">
        <h1>{t.printHeading}: {first} → {last}</h1>
        <div>
          {aircraft.name}{aircraft.registration ? ` · ${aircraft.registration}` : ''} · TAS {aircraft.tasKt} kt ·
          W/V {String(route.wind.fromDeg).padStart(3, '0')}°/{route.wind.speedKt} kt · {route.cruiseAltFt} ft ·
          EOBT {fields.item13.slice(-4)} UTC {new Date(draft.eobt).toISOString().slice(0, 10)}
        </div>
      </header>

      <h2>ICAO FPL</h2>
      <table className="pr-fpl">
        <tbody>
          {(['item7', 'item8', 'item9', 'item10', 'item13', 'item15', 'item16', 'item18', 'item19'] as const).map((k) => (
            <tr key={k}><th>{k.replace('item', '')}</th><td>{fields[k]}</td></tr>
          ))}
        </tbody>
      </table>
      <pre className="pr-msg">{buildFplMessage(input)}</pre>

      {log && (
        <>
          <h2>{t.tabNavlog}</h2>
          <table className="pr-log">
            <thead>
              <tr>
                <th>{t.leg}</th><th>TT</th><th>VAR</th><th>MT</th><th>WCA</th><th>MH</th><th>NM</th><th>GS</th>
                <th>ETE</th><th>Σ</th><th>{t.colFuel}</th><th>ATA</th><th>{t.remarksLbl.split(' ')[0]}</th>
              </tr>
            </thead>
            <tbody>
              {log.legs.map((l, i) => (
                <tr key={i}>
                  <td>{l.from.name} → {l.to.name}</td>
                  <td>{trk(l.trueTrack)}</td><td>{formatVarShort(l.variation)}</td><td>{trk(l.magTrack)}</td>
                  <td>{formatWca(l.wca)}</td><td className="b">{trk(l.magHeading)}</td><td>{l.distanceNm.toFixed(1)}</td>
                  <td>{l.groundSpeed == null ? '—' : Math.round(l.groundSpeed)}</td><td className="b">{formatDuration(l.eteMin)}</td>
                  <td>{formatDuration(l.cumMin)}</td><td>{l.fuel == null ? '—' : l.fuel.toFixed(1)}</td>
                  <td className="blank" /><td className="blank" />
                </tr>
              ))}
            </tbody>
          </table>
          <table className="pr-fuel">
            <tbody>
              <tr><th>{t.distance}</th><td>{log.totals.distanceNm.toFixed(1)} NM</td><th>{t.flightTime}</th><td>{formatDuration(log.totals.timeMin)}</td></tr>
              <tr><th>{t.taxiFuel}</th><td>{formatFuel(log.totals.taxiFuel, u)}</td><th>{t.tripFuel}</th><td>{formatFuel(log.totals.tripFuel, u)}</td></tr>
              <tr><th>{t.reserveFuel} ({aircraft.reserveMinutes} {t.minutes})</th><td>{formatFuel(log.totals.reserveFuel, u)}</td><th>{t.requiredFuel}</th><td className="b">{formatFuel(log.totals.requiredFuel, u)}</td></tr>
              <tr><th>{t.usableFuel}</th><td>{formatFuel(aircraft.usableFuel, u)}</td><th>{(log.totals.extraFuel ?? 0) < 0 ? t.shortfall : t.extraFuel}</th><td className="b">{formatFuel(Math.abs(log.totals.extraFuel ?? 0), u)}</td></tr>
            </tbody>
          </table>
        </>
      )}

      {crossings.length > 0 && (
        <>
          <h2>{t.airspaceOnRoute} ({route.cruiseAltFt} ft)</h2>
          <table className="pr-cx">
            <tbody>
              {crossings.map((c, i) => (
                <tr key={i}>
                  <td>{c.entryNm.toFixed(1)}–{c.exitNm.toFixed(1)} NM</td>
                  <td className="b">{c.airspace.name}</td>
                  <td>{airspaceBadge(c.airspace.type, c.airspace.cls)}</td>
                  <td>{formatLimit(c.airspace.lower)} – {formatLimit(c.airspace.upper)}</td>
                  <td>{c.vertical.status === 'inside' ? t.stInside : c.vertical.status === 'check' ? t.stCheck : c.vertical.status === 'below' ? t.stBelow : t.stAbove}{c.vertical.marginal ? ` (${t.stMarginal})` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <footer className="pr-foot">
        {t.disclaimerShort} {t.navlogNote} — {t.printed} {new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC · BG VFR Planner {__APP_VERSION__} · {data?.meta.attribution}
      </footer>
    </div>,
    document.body,
  );
}
