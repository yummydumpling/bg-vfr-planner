import { useMemo } from 'react';
import type { Aircraft } from '../domain/types';
import { buildFields, buildFplMessage, checkFpl, type FplFields } from '../fpl/fpl';
import { fplInputFrom } from '../fpl/fromState';
import { useT } from '../i18n';
import type { Dict } from '../i18n/en';
import type { NavLog } from '../nav/navlog';
import { useFlightPlan } from '../store/flightPlan';
import { useRoute } from '../store/route';
import { CopyButton } from './CopyButton';
import { IconEdit, IconExternal } from './icons';
import { NumField } from './NumField';
import { shareText } from './share';

const FIELD_KEYS: { key: keyof FplFields; item: string; label: keyof Dict }[] = [
  { key: 'item7', item: '7', label: 'it7' },
  { key: 'item8', item: '8', label: 'it8' },
  { key: 'item9', item: '9', label: 'it9' },
  { key: 'item10', item: '10', label: 'it10' },
  { key: 'item13', item: '13', label: 'it13' },
  { key: 'item15', item: '15', label: 'it15' },
  { key: 'item16', item: '16', label: 'it16' },
  { key: 'item18', item: '18', label: 'it18' },
  { key: 'item19', item: '19', label: 'it19' },
];

const two = (n: number) => String(n).padStart(2, '0');
const utcDate = (d: Date) => `${d.getUTCFullYear()}-${two(d.getUTCMonth() + 1)}-${two(d.getUTCDate())}`;
const utcTime = (d: Date) => `${two(d.getUTCHours())}:${two(d.getUTCMinutes())}`;

export function FlightPlanPanel({ aircraft, log, onEditAircraft, onPrint }: {
  aircraft: Aircraft; log: NavLog | null; onEditAircraft: () => void; onPrint: () => void;
}) {
  const t = useT();
  const route = useRoute((s) => s.route);
  const setAlternates = useRoute((s) => s.setAlternates);
  const { pilot, draft, setPilot, setDraft } = useFlightPlan();

  const input = useMemo(() => fplInputFrom(route, aircraft, pilot, draft, log), [route, aircraft, pilot, draft, log]);
  const fields = useMemo(() => buildFields(input), [input]);
  const message = useMemo(() => buildFplMessage(input), [input]);
  const problems = checkFpl(input);
  const eobt = new Date(draft.eobt);
  const local = eobt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const setEobt = (date: string, time: string) => {
    const d = new Date(`${date}T${time}:00Z`);
    if (!Number.isNaN(d.getTime())) setDraft({ eobt: d.toISOString() });
  };
  const alt = (i: number, v: string) => {
    const a = [...route.alternates];
    a[i] = v.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
    setAlternates(a.filter((x, k) => x || k < 2));
  };
  const shareBody = `${message}\n\n-${fields.item19}`;

  return (
    <div className="fpl">
      <section>
        <h3>{t.thisFlight}</h3>
        <div className="field-row">
          <label className="field">
            <span className="field-label">{t.dateUtc}</span>
            <span className="field-input"><input type="date" value={utcDate(eobt)} onChange={(e) => setEobt(e.target.value, utcTime(eobt))} /></span>
          </label>
          <label className="field">
            <span className="field-label">{t.eobtUtc}</span>
            <span className="field-input">
              <input type="time" value={utcTime(eobt)} onChange={(e) => setEobt(utcDate(eobt), e.target.value)} />
              <span className="field-suffix">UTC · {local} {t.localTime}</span>
            </span>
          </label>
        </div>
        <div className="field-row">
          <NumField label={t.persons} value={draft.persons} onChange={(v) => setDraft({ persons: v })} />
          <div className="field">
            <span className="field-label">{t.levelItem}</span>
            <div className="segmented" role="radiogroup">
              <button type="button" role="radio" aria-checked={draft.levelMode === 'VFR'} className={draft.levelMode === 'VFR' ? 'active' : ''} onClick={() => setDraft({ levelMode: 'VFR' })}>{t.levelVfr}</button>
              <button type="button" role="radio" aria-checked={draft.levelMode === 'ALT'} className={draft.levelMode === 'ALT' ? 'active' : ''} onClick={() => setDraft({ levelMode: 'ALT' })}>{t.levelAlt} {route.cruiseAltFt} ft</button>
            </div>
          </div>
        </div>
        <div className="field">
          <span className="field-label">{t.alternatesLbl}</span>
          <div className="field-row">
            {[0, 1].map((i) => (
              <span className="field-input" key={i}>
                <input value={route.alternates[i] ?? ''} onChange={(e) => alt(i, e.target.value)} placeholder={i === 0 ? 'LBPD' : ''} autoCapitalize="characters" maxLength={4} aria-label={`${t.alternatesLbl} ${i + 1}`} />
              </span>
            ))}
          </div>
        </div>
        <label className="field">
          <span className="field-label">{t.remarksLbl}</span>
          <span className="field-input"><input value={draft.remarks} onChange={(e) => setDraft({ remarks: e.target.value })} autoCapitalize="characters" /></span>
        </label>
        <label className="check-row">
          <input type="checkbox" checked={draft.reportingPointNames} onChange={(e) => setDraft({ reportingPointNames: e.target.checked })} />
          <span>{t.rpNames}</span>
        </label>
      </section>

      <section>
        <h3>{t.pilotSection}</h3>
        <div className="field-row">
          <label className="field">
            <span className="field-label">{t.pilotName}</span>
            <span className="field-input"><input value={pilot.name} onChange={(e) => setPilot({ name: e.target.value })} autoComplete="name" /></span>
          </label>
          <label className="field">
            <span className="field-label">{t.pilotPhone}</span>
            <span className="field-input"><input type="tel" value={pilot.phone} onChange={(e) => setPilot({ phone: e.target.value })} autoComplete="tel" /></span>
          </label>
        </div>
        <label className="check-row">
          <input type="checkbox" checked={pilot.phoneInRemarks} onChange={(e) => setPilot({ phoneInRemarks: e.target.checked })} />
          <span>{t.phoneInRmk}</span>
        </label>
      </section>

      <section>
        <h3>
          {t.aircraft}: {aircraft.name}{aircraft.registration ? ` · ${aircraft.registration}` : ''}
          <button className="btn-icon xs inline-edit" onClick={onEditAircraft} aria-label={t.editAircraft}><IconEdit /></button>
        </h3>
      </section>

      {problems.length > 0 && (
        <ul className="problems">
          {problems.map((p) => (
            <li key={p}>{t[({ aircraftId: 'pAircraftId', route: 'pRoute', eobtPast: 'pEobtPast', speed: 'pSpeed' } as const)[p]]}</li>
          ))}
        </ul>
      )}

      <section>
        <h3>{t.fieldsTitle}</h3>
        <dl className="fpl-fields">
          {FIELD_KEYS.map(({ key, item, label }) => (
            <div key={key}>
              <dt><span className="item-no">{item}</span> {t[label] as string}</dt>
              <dd>
                <code>{fields[key] || t.emptyField}</code>
                <CopyButton text={fields[key]} />
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h3>{t.messageTitle}</h3>
        <pre className="fpl-message">{message}</pre>
        <div className="fpl-actions">
          <CopyButton text={message} label={t.copyMessage} className="btn-secondary" />
          <button className="btn-secondary" onClick={() => void shareText('Flight plan', shareBody)}>{t.share}</button>
          <button className="btn-secondary" onClick={onPrint}>{t.print}</button>
          <a className="btn-secondary" href="https://b-flip.bulatsa.com/" target="_blank" rel="noopener">{t.openBflip} <IconExternal /></a>
        </div>
        <p className="muted small">{t.fplNote}</p>
      </section>
    </div>
  );
}
