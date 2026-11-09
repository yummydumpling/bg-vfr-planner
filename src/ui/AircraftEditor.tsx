import { useState } from 'react';
import type { Aircraft } from '../domain/types';
import { validateAircraft } from '../flight/aircraft';
import { useT } from '../i18n';
import type { Dict } from '../i18n/en';
import { useAircraft } from '../store/aircraft';
import { IconClose } from './icons';
import { NumField } from './NumField';

export function AircraftEditor({ initial, onClose }: { initial: Aircraft; onClose: () => void }) {
  const t = useT();
  const [a, setA] = useState<Aircraft>(initial);
  const { save, remove, list } = useAircraft();
  const errors = validateAircraft(a);
  const valid = Object.keys(errors).length === 0;
  const err = (k: keyof Aircraft) => (errors[k] ? t[errors[k] as keyof Dict] as string : undefined);
  const set = <K extends keyof Aircraft>(k: K, v: Aircraft[K]) => setA((x) => ({ ...x, [k]: v }));
  const isNew = !list.some((x) => x.id === a.id);
  const u = a.fuelUnit === 'L' ? 'L' : 'USG';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal form" role="dialog" aria-modal="true" aria-labelledby="ac-title" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <h2 id="ac-title">{isNew ? t.newAircraft : t.editAircraft}</h2>
          <button className="btn-icon" onClick={onClose} aria-label={t.close}><IconClose /></button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!valid) return;
            save({ ...a, name: a.name.trim(), registration: a.registration.trim().toUpperCase(), icaoType: a.icaoType.trim().toUpperCase() });
            onClose();
          }}
        >
          <label className={`field${errors.name ? ' has-error' : ''}`}>
            <span className="field-label">{t.acName}</span>
            <span className="field-input"><input value={a.name} onChange={(e) => set('name', e.target.value)} autoComplete="off" /></span>
            {err('name') && <span className="field-error">{err('name')}</span>}
          </label>
          <div className="field-row">
            <label className="field">
              <span className="field-label">{t.registration}</span>
              <span className="field-input">
                <input value={a.registration} onChange={(e) => set('registration', e.target.value.toUpperCase())} autoCapitalize="characters" autoComplete="off" placeholder="LZ-ABC" />
              </span>
            </label>
            <label className={`field${errors.icaoType ? ' has-error' : ''}`}>
              <span className="field-label">{t.icaoType}</span>
              <span className="field-input">
                <input value={a.icaoType} onChange={(e) => set('icaoType', e.target.value.toUpperCase())} autoCapitalize="characters" autoComplete="off" placeholder="C172" maxLength={4} />
              </span>
              {err('icaoType') && <span className="field-error">{err('icaoType')}</span>}
            </label>
          </div>
          <NumField label={t.tas} value={a.tasKt} onChange={(v) => set('tasKt', v)} suffix="kt" error={err('tasKt')} />
          <div className="field">
            <span className="field-label">{t.fuelUnit}</span>
            <div className="segmented" role="radiogroup">
              {(['L', 'USG'] as const).map((unit) => (
                <button type="button" key={unit} role="radio" aria-checked={a.fuelUnit === unit}
                  className={a.fuelUnit === unit ? 'active' : ''} onClick={() => set('fuelUnit', unit)}>
                  {unit === 'L' ? t.litres : t.usg}
                </button>
              ))}
            </div>
          </div>
          <div className="field-row">
            <NumField label={t.fuelBurn} value={a.fuelBurnPerHour} onChange={(v) => set('fuelBurnPerHour', v)} suffix={`${u}${t.perHour}`} decimal error={err('fuelBurnPerHour')} />
            <NumField label={t.usableFuel} value={a.usableFuel} onChange={(v) => set('usableFuel', v)} suffix={u} decimal error={err('usableFuel')} />
          </div>
          <div className="field-row">
            <NumField label={t.taxiFuel} value={a.taxiFuel} onChange={(v) => set('taxiFuel', v)} suffix={u} decimal error={err('taxiFuel')} />
            <NumField label={t.reserve} value={a.reserveMinutes} onChange={(v) => set('reserveMinutes', v)} suffix={t.minutes} error={err('reserveMinutes')} />
          </div>
          <h3 className="form-sub">{t.fplDetails}</h3>
          <div className="field-row">
            <div className="field">
              <span className="field-label">{t.wakeLbl}</span>
              <div className="segmented" role="radiogroup">
                {(['L', 'M'] as const).map((w) => (
                  <button type="button" key={w} role="radio" aria-checked={a.wake === w} className={a.wake === w ? 'active' : ''} onClick={() => set('wake', w)}>{w}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="field-row">
            {(['equipment', 'surveillance'] as const).map((k) => (
              <label key={k} className={`field${errors[k] ? ' has-error' : ''}`}>
                <span className="field-label">{k === 'equipment' ? t.equipmentLbl : t.surveillanceLbl}</span>
                <span className="field-input">
                  <input value={a[k]} onChange={(e) => set(k, e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} autoCapitalize="characters" autoComplete="off" placeholder={k === 'equipment' ? 'SY' : 'C'} />
                </span>
                {err(k) && <span className="field-error">{err(k)}</span>}
              </label>
            ))}
          </div>
          <label className="field">
            <span className="field-label">{t.colourLbl}</span>
            <span className="field-input"><input value={a.colour} onChange={(e) => set('colour', e.target.value.toUpperCase())} autoCapitalize="characters" autoComplete="off" placeholder="WHITE BLUE" /></span>
          </label>
          <div className="field-row three">
            {([['emergencyRadio', t.emergencyRadioLbl, 'UVE'], ['survival', t.survivalLbl, 'PDMJ'], ['jackets', t.jacketsLbl, 'LFUV']] as const).map(([k, label, allowed]) => (
              <label key={k} className="field compact">
                <span className="field-label">{label}</span>
                <span className="field-input">
                  <input value={a[k]} maxLength={4} autoCapitalize="characters" autoComplete="off"
                    onChange={(e) => set(k, [...new Set(e.target.value.toUpperCase().split('').filter((c) => allowed.includes(c)))].join(''))} />
                </span>
              </label>
            ))}
          </div>
          <div className="form-actions">
            {!isNew && list.length > 1 && (
              <button type="button" className="btn-text danger" onClick={() => { remove(a.id); onClose(); }}>{t.delete}</button>
            )}
            <span className="spacer" />
            <button type="button" className="btn-text" onClick={onClose}>{t.cancel}</button>
            <button type="submit" className="btn-primary inline" disabled={!valid}>{t.save}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
