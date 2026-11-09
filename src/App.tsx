import { useEffect, useState } from 'react';
import { useT } from './i18n';
import { MapView } from './map/MapView';
import { useData } from './store/data';
import { useSettings } from './store/settings';
import { DisclaimerBar, DisclaimerModal } from './ui/Disclaimer';
import { InfoSheet } from './ui/InfoSheet';
import { LayersPanel } from './ui/LayersPanel';
import { TopBar } from './ui/TopBar';

export default function App() {
  const t = useT();
  const theme = useSettings((s) => s.theme);
  const lang = useSettings((s) => s.lang);
  const load = useData((s) => s.load);
  const loaded = useData((s) => !!s.data);
  const error = useData((s) => s.error);
  const [layersOpen, setLayersOpen] = useState(false);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.lang = lang;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0b0f14' : '#0b2545');
  }, [theme, lang]);

  return (
    <div className="app">
      <TopBar onLayers={() => setLayersOpen((o) => !o)} />
      <main className="main">
        <MapView />
        {!loaded && !error && <div className="toast">{t.loading}</div>}
        {error && <div className="toast error">{t.loadError} ({error})</div>}
        {layersOpen && <LayersPanel onClose={() => setLayersOpen(false)} />}
        <InfoSheet />
      </main>
      <DisclaimerBar />
      <DisclaimerModal />
    </div>
  );
}
