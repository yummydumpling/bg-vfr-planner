import { useEffect, useState } from 'react';
import { useT } from './i18n';
import { MapView } from './map/MapView';
import { useData } from './store/data';
import { useRoute } from './store/route';
import { useSettings } from './store/settings';
import { DisclaimerBar, DisclaimerModal } from './ui/Disclaimer';
import { InfoSheet } from './ui/InfoSheet';
import { LayersPanel } from './ui/LayersPanel';
import { NavLogPanel } from './ui/NavLogPanel';
import { PrintView } from './ui/PrintView';
import { RouteButton, RoutePanel } from './ui/RoutePanel';
import { RoutesPanel } from './ui/RoutesPanel';
import { TopBar } from './ui/TopBar';
import { UpdateBar } from './ui/UpdateBar';

export default function App() {
  const t = useT();
  const theme = useSettings((s) => s.theme);
  const lang = useSettings((s) => s.lang);
  const load = useData((s) => s.load);
  const loaded = useData((s) => !!s.data);
  const error = useData((s) => s.error);
  const [layersOpen, setLayersOpen] = useState(false);
  const [navLogOpen, setNavLogOpen] = useState(false);
  const [routesOpen, setRoutesOpen] = useState(false);
  const [printing, setPrinting] = useState(false);

  // Render the print document, open the print dialog, then remove it again.
  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(false);
    window.addEventListener('afterprint', done);
    const id = window.setTimeout(() => window.print(), 50);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('afterprint', done);
    };
  }, [printing]);
  const planning = useRoute((s) => s.planning);

  // Entering planning mode: taps add waypoints, so close any info card.
  useEffect(() => {
    if (planning) useData.getState().select(null);
  }, [planning]);

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
      <TopBar onLayers={() => setLayersOpen((o) => !o)} onNavLog={() => { setRoutesOpen(false); setNavLogOpen((o) => !o); }} onRoutes={() => { setNavLogOpen(false); setRoutesOpen((o) => !o); }} />
      <main className="main">
        <MapView />
        <UpdateBar />
        {!loaded && !error && <div className="toast">{t.loading}</div>}
        {error && <div className="toast error">{t.loadError} ({error})</div>}
        {layersOpen && <LayersPanel onClose={() => setLayersOpen(false)} />}
        <RouteButton />
        <RoutePanel onNavLog={() => setNavLogOpen(true)} />
        <InfoSheet />
        {routesOpen && <RoutesPanel onClose={() => setRoutesOpen(false)} />}
        {navLogOpen && <NavLogPanel onClose={() => setNavLogOpen(false)} onPrint={() => setPrinting(true)} />}
      </main>
      <DisclaimerBar />
      <DisclaimerModal />
      {printing && <PrintView />}
    </div>
  );
}
