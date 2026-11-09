import { useEffect, useMemo } from 'react';
import { useT } from '../i18n';
import { useRoute } from '../store/route';
import { useWeather } from '../store/weather';
import { StationWeather, WeatherStatus } from './StationWeather';

const isIcao = (s: string | undefined): s is string => !!s && /^[A-Z]{4}$/.test(s);

/** Weather for departure, destination and alternates. */
export function WeatherPanel() {
  const t = useT();
  const route = useRoute((s) => s.route);
  const refresh = useWeather((s) => s.refresh);

  const stations = useMemo(() => {
    const wps = route.waypoints;
    const list: { icao: string; role: string }[] = [];
    const add = (icao: string | undefined, role: string) => {
      if (!isIcao(icao)) return;
      const existing = list.find((x) => x.icao === icao);
      if (existing) existing.role += ` / ${role}`;
      else list.push({ icao, role });
    };
    const dep = wps[0];
    const dest = wps[wps.length - 1];
    if (dep?.kind === 'airport') add(dep.name, t.roleDep);
    if (wps.length > 1 && dest?.kind === 'airport') add(dest.name, t.roleDest);
    route.alternates.forEach((a) => add(a, t.roleAltn));
    return list;
  }, [route.waypoints, route.alternates, t]);

  const ids = stations.map((s) => s.icao);
  const key = ids.join(',');
  useEffect(() => {
    if (key) void refresh(key.split(','));
  }, [key, refresh]);

  return (
    <div className="wx-panel">
      {stations.length === 0 ? (
        <p className="muted">{t.wxNeedAerodromes}</p>
      ) : (
        <>
          <WeatherStatus ids={ids} />
          {stations.map((s) => <StationWeather key={s.icao} icao={s.icao} role={s.role} />)}
        </>
      )}
      <p className="muted small">{t.wxSource}</p>
    </div>
  );
}
