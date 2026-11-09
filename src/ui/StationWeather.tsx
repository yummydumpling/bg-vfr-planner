import { useEffect, useState } from 'react';
import { useT } from '../i18n';
import { useWeather } from '../store/weather';
import { formatAge, formatTaf, formatUtc, metarAgeLevel, minutesSince, tafExpired } from '../weather/weather';

/** Re-render every minute so report ages stay current. */
function useMinuteTick() {
  const [, setN] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setN((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);
}

export function StationWeather({ icao, role }: { icao: string; role?: string }) {
  const t = useT();
  useMinuteTick();
  const st = useWeather((s) => s.stations[icao]);
  const ago = (iso: string) => `${t.agoPrefix}${formatAge(minutesSince(iso))}${t.agoSuffix}`;
  const m = st?.metar;
  const taf = st?.taf;
  const level = m ? metarAgeLevel(m.observed) : null;

  return (
    <div className="wx-station">
      <div className="wx-head">
        <span className="ident">{icao}</span>
        {role && <span className="badge">{role}</span>}
        {m?.category && <span className={`badge cat cat-${m.category}`}>{m.category}</span>}
      </div>
      {!st && <p className="muted small">…</p>}
      {st && (
        <>
          <div className="wx-block">
            <div className="wx-label">
              METAR
              {m && (
                <span className={`wx-age age-${level}`}>
                  {t.wxObserved} {formatUtc(m.observed)} · {ago(m.observed)}
                  {level === 'old' && <strong> · {t.wxOld}</strong>}
                </span>
              )}
            </div>
            {m ? <pre className="wx-raw">{m.raw}</pre> : <p className="muted small">{t.noMetar}</p>}
          </div>
          <div className="wx-block">
            <div className="wx-label">
              TAF
              {taf && (
                <span className={`wx-age${tafExpired(taf) ? ' age-old' : ''}`}>
                  {t.wxIssued} {formatUtc(taf.issued)} · {t.wxValid} {formatUtc(taf.validFrom).slice(3)}–{formatUtc(taf.validTo)}
                  {tafExpired(taf) && <strong> · {t.wxExpired}</strong>}
                </span>
              )}
            </div>
            {taf ? <pre className="wx-raw">{formatTaf(taf.raw)}</pre> : <p className="muted small">{t.noTaf}</p>}
          </div>
          {!m && !taf && <p className="muted small">{t.noStationNote}</p>}
        </>
      )}
    </div>
  );
}

/** Status line + refresh button for a set of stations. */
export function WeatherStatus({ ids }: { ids: string[] }) {
  const t = useT();
  const { loading, error, configured, refresh, stations } = useWeather();
  useMinuteTick();
  const times = ids.map((id) => stations[id]?.fetchedAt).filter(Boolean) as string[];
  const oldest = times.length ? times.sort()[0] : null;
  if (!configured) return <p className="alert-soft">{t.wxNotConfigured}</p>;
  return (
    <div className="wx-status">
      <span className="muted small">
        {oldest && <>{t.wxUpdated} {t.agoPrefix}{formatAge(minutesSince(oldest))}{t.agoSuffix}</>}
      </span>
      <button className="btn-copy" onClick={() => void refresh(ids, true)} disabled={loading}>
        {loading ? '…' : `↻ ${t.wxRefresh}`}
      </button>
      {error && <p className="alert-soft">{t.wxError}</p>}
    </div>
  );
}
