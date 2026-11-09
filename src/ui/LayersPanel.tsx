import { useT } from '../i18n';
import { useData } from '../store/data';
import { useSettings, type LayerKey } from '../store/settings';
import { IconClose } from './icons';

const ROWS: { key: LayerKey; label: (t: ReturnType<typeof useT>) => string; swatch: string }[] = [
  { key: 'controlled', label: (t) => t.lyrControlled, swatch: 'sw-ctr' },
  { key: 'atz', label: (t) => t.lyrAtz, swatch: 'sw-atz' },
  { key: 'restricted', label: (t) => t.lyrRestricted, swatch: 'sw-restricted' },
  { key: 'zones', label: (t) => t.lyrZones, swatch: 'sw-zone' },
  { key: 'fir', label: (t) => t.lyrFir, swatch: 'sw-fir' },
  { key: 'other', label: (t) => t.lyrOther, swatch: 'sw-other' },
  { key: 'airports', label: (t) => t.lyrAirports, swatch: 'sw-airport' },
  { key: 'reporting', label: (t) => t.lyrReporting, swatch: 'sw-rp' },
  { key: 'navaids', label: (t) => t.lyrNavaids, swatch: 'sw-nav' },
];

export function LayersPanel({ onClose }: { onClose: () => void }) {
  const t = useT();
  const layers = useSettings((s) => s.layers);
  const toggle = useSettings((s) => s.toggleLayer);
  const meta = useData((s) => s.data?.meta);
  return (
    <aside className="panel" aria-label={t.layers}>
      <div className="panel-head">
        <h2>{t.layers}</h2>
        <button className="btn-icon" onClick={onClose} aria-label={t.close}><IconClose /></button>
      </div>
      <ul className="layer-list">
        {ROWS.map((r) => (
          <li key={r.key}>
            <label>
              <input type="checkbox" checked={layers[r.key]} onChange={() => toggle(r.key)} />
              <span className={`swatch ${r.swatch}`} aria-hidden />
              <span>{r.label(t)}</span>
            </label>
          </li>
        ))}
      </ul>
      <section className="about">
        <h3>{t.about}</h3>
        <ul>
          <li>
            {t.dataSource}: <a href="https://www.openaip.net" target="_blank" rel="noopener">openAIP</a>{' '}
            (<a href="https://creativecommons.org/licenses/by-nc/4.0/" target="_blank" rel="noopener">CC BY-NC 4.0</a>)
            {meta && <> — {t.dataFetched} {meta.fetchedAt.slice(0, 10)}</>}
          </li>
          <li>
            Map: <a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> ©{' '}
            <a href="https://openmaptiles.org" target="_blank" rel="noopener">OpenMapTiles</a>, data ©{' '}
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>
          </li>
          <li>
            Magnetic variation: NOAA/BGS{' '}
            <a href="https://www.ncei.noaa.gov/products/world-magnetic-model" target="_blank" rel="noopener">WMM2025</a>
          </li>
          <li>
            AIP Bulgaria: <a href="https://b-flip.bulatsa.com" target="_blank" rel="noopener">BULATSA B-FLIP</a>
          </li>
        </ul>
      </section>
    </aside>
  );
}
