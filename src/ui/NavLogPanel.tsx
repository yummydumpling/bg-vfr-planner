import { useMemo, useState } from 'react';
import type { Aircraft } from '../domain/types';
import { defaultAircraft } from '../flight/aircraft';
import { buildNavLog, formatFuel, formatVarShort, formatWca } from '../flight/plan';
import { useT } from '../i18n';
import { norm360 } from '../nav/geo';
import { formatDuration } from '../nav/navlog';
import { formatTrack } from '../route/legs';
import { useAircraft, useSelectedAircraft } from '../store/aircraft';
import { useRoute } from '../store/route';
import { AircraftEditor } from './AircraftEditor';
import { IconClose, IconEdit, IconPlus } from './icons';
import { NumField } from './NumField';

const trk = (v: number | null) => (v == null ? '—' : formatTrack(v));

export function NavLogPanel({ onClose }: { onClose: () => void }) {
  const t = useT();
  const route = useRoute((s) => s.route);
  const setWind = useRoute((s) => s.setWind);
  const setCruiseAlt = useRoute((s) => s.setCruiseAlt);
  const aircraft = useSelectedAircraft();
  const { list, select, duplicate } = useAircraft();
  const [editing, setEditing] = useState<Aircraft | null>(null);

  const windValid = Number.isFinite(route.wind.fromDeg) && Number.isFinite(route.wind.speedKt) && route.wind.speedKt >= 0;
  const log = useMemo(
    () => (route.waypoints.length >= 2 && windValid ? buildNavLog(route, aircraft) : null),
    [route, aircraft, windValid],
  );
  const u = aircraft.fuelUnit;
  const unflyable = log?.legs.some((l) => l.groundSpeed == null);
  const extra = log?.totals.extraFuel;

  return (
    <section className="fullsheet" aria-label={t.navlog}>
      <div className="panel-head sticky">
        <h2>{t.navlog}</h2>
        <button className="btn-icon" onClick={onClose} aria-label={t.close}><IconClose /></button>
      </div>

      <div className="nl-settings">
        <div className="field">
          <span className="field-label">{t.aircraft}</span>
          <div className="ac-row">
            <select value={aircraft.id} onChange={(e) => select(e.target.value)} aria-label={t.aircraft}>
              {list.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}{a.registration ? ` · ${a.registration}` : ''} — {a.tasKt} kt, {a.fuelBurnPerHour} {a.fuelUnit}{t.perHour}
                </option>
              ))}
            </select>
            <button className="btn-icon sm" onClick={() => setEditing(aircraft)} aria-label={t.editAircraft} title={t.editAircraft}><IconEdit /></button>
            <button className="btn-icon sm" onClick={() => setEditing(duplicate(aircraft.id) ?? defaultAircraft())} aria-label={t.newAircraft} title={t.newAircraft}><IconPlus /></button>
          </div>
        </div>
        <div className="field-row three">
          <NumField compact label={t.windDir} value={route.wind.fromDeg}
            onChange={(v) => setWind({ ...route.wind, fromDeg: v })} normalize={(v) => norm360(Math.round(v))} suffix="°T" />
          <NumField compact label={t.windSpeed} value={route.wind.speedKt}
            onChange={(v) => setWind({ ...route.wind, speedKt: v })} suffix="kt" />
          <NumField compact label={t.cruiseAlt} value={route.cruiseAltFt}
            onChange={(v) => setCruiseAlt(v)} suffix="ft" />
        </div>
      </div>

      {!log ? (
        <p className="muted pad">{route.waypoints.length < 2 ? t.needTwoPoints : `${t.wind}: ${t.errRequired}`}</p>
      ) : (
        <>
          {unflyable && <div className="alert">{t.unflyable}</div>}
          <div className="table-scroll">
            <table className="navlog">
              <thead>
                <tr>
                  <th className="sticky-col">{t.leg}</th>
                  <th>{t.colTT}</th><th>{t.colVar}</th><th>{t.colMT}</th><th>{t.colWCA}</th>
                  <th className="hl">{t.colMH}</th><th>{t.colDist}</th><th>{t.colGS}</th>
                  <th className="hl">{t.colETE}</th><th>{t.colCumTime}</th>
                  <th>{t.colFuel}</th><th>{t.colCumFuel}</th>
                </tr>
              </thead>
              <tbody>
                {log.legs.map((l, i) => (
                  <tr key={i} className={l.groundSpeed == null ? 'bad' : undefined}>
                    <td className="sticky-col leg-cell">
                      <span className="leg-from">{l.from.name}</span>
                      <span className="leg-to">→ {l.to.name}</span>
                    </td>
                    <td>{trk(l.trueTrack)}</td>
                    <td>{formatVarShort(l.variation)}</td>
                    <td>{trk(l.magTrack)}</td>
                    <td>{formatWca(l.wca)}</td>
                    <td className="hl strong">{trk(l.magHeading)}</td>
                    <td>{l.distanceNm.toFixed(1)}</td>
                    <td>{l.groundSpeed == null ? '—' : Math.round(l.groundSpeed)}</td>
                    <td className="hl strong">{formatDuration(l.eteMin)}</td>
                    <td>{formatDuration(l.cumMin)}</td>
                    <td>{l.fuel == null ? '—' : l.fuel.toFixed(1)}</td>
                    <td>{l.cumFuel == null ? '—' : l.cumFuel.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="sticky-col strong">{t.totals}</td>
                  <td colSpan={5} />
                  <td className="strong">{log.totals.distanceNm.toFixed(1)}</td>
                  <td />
                  <td className="strong" colSpan={2}>{formatDuration(log.totals.timeMin)}</td>
                  <td className="strong" colSpan={2}>{formatFuel(log.totals.tripFuel, u)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="muted small pad">{t.legend}</p>

          <div className="fuel-summary">
            <h3>{t.totals}</h3>
            <dl>
              <div><dt>{t.distance}</dt><dd>{log.totals.distanceNm.toFixed(1)} NM</dd></div>
              <div><dt>{t.flightTime}</dt><dd>{formatDuration(log.totals.timeMin)}</dd></div>
              <div><dt>{t.taxiFuel}</dt><dd>{formatFuel(log.totals.taxiFuel, u)}</dd></div>
              <div><dt>{t.tripFuel}</dt><dd>{formatFuel(log.totals.tripFuel, u)}</dd></div>
              <div><dt>{t.reserveFuel} ({aircraft.reserveMinutes} {t.minutes})</dt><dd>{formatFuel(log.totals.reserveFuel, u)}</dd></div>
              <div className="sum"><dt>{t.requiredFuel}</dt><dd>{formatFuel(log.totals.requiredFuel, u)}</dd></div>
              <div><dt>{t.usableFuel}</dt><dd>{formatFuel(aircraft.usableFuel, u)}</dd></div>
              <div className={extra != null && extra < 0 ? 'bad' : 'good'}>
                <dt>{extra != null && extra < 0 ? t.shortfall : t.extraFuel}</dt>
                <dd>{formatFuel(extra == null ? null : Math.abs(extra), u)}</dd>
              </div>
              <div><dt>{t.endurance}</dt><dd>{formatDuration(log.totals.enduranceMin ?? null)}</dd></div>
            </dl>
          </div>
          <p className="muted small pad">{t.navlogNote}</p>
          <p className="muted small pad">{t.disclaimerShort}</p>
        </>
      )}
      {editing && <AircraftEditor initial={editing} onClose={() => setEditing(null)} />}
    </section>
  );
}
