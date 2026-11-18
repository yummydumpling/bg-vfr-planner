import { useEffect, useState } from 'react';
import { checkAgeLevel, dataAgeDays, dataAgeLevel, formatDataDate, relativeDays } from '../domain/dataAge';
import { useT } from '../i18n';
import { useData } from '../store/data';
import { useSettings } from '../store/settings';

/** Small map label: when the built-in aeronautical data was last updated. */
export function DataAgeBadge({ onOpen }: { onOpen: () => void }) {
  const t = useT();
  const lang = useSettings((s) => s.lang);
  const fetchedAt = useData((s) => s.data?.meta.fetchedAt);
  const checkedAt = useData((s) => s.status?.checkedAt);
  // re-evaluate "N days ago" once an hour while the app stays open
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 3_600_000);
    return () => clearInterval(id);
  }, []);
  if (!fetchedAt) return null;
  const days = dataAgeDays(fetchedAt);
  if (checkedAt) {
    const checkedDays = dataAgeDays(checkedAt);
    const level = checkAgeLevel(checkedDays);
    return (
      <button className={`data-age age-${level}`} onClick={onOpen} title={t.dataAgeHint} aria-label={t.dataAgeHint}>
        {t.dataLabel}: {t.dataChanged} <strong>{formatDataDate(fetchedAt, lang)}</strong> · {t.dataChecked} {relativeDays(checkedDays, lang)}
        {level === 'outdated' && <strong> · {t.dataOutdated}</strong>}
      </button>
    );
  }
  const level = dataAgeLevel(days);
  return (
    <button className={`data-age age-${level}`} onClick={onOpen} title={t.dataAgeHint} aria-label={t.dataAgeHint}>
      {t.dataLabel}: <strong>{formatDataDate(fetchedAt, lang)}</strong> · {relativeDays(days, lang)}
      {level === 'outdated' && <strong> · {t.dataOutdated}</strong>}
    </button>
  );
}
