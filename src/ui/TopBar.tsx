import { useT } from '../i18n';
import { useSettings } from '../store/settings';
import { IconFolder, IconLayers, IconMoon, IconSun, IconTable } from './icons';

export function TopBar({ onLayers, onNavLog, onRoutes }: { onLayers: () => void; onNavLog: () => void; onRoutes: () => void }) {
  const t = useT();
  const { lang, setLang, theme, setTheme } = useSettings();
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark" aria-hidden>BG</span>
        <span className="brand-name">VFR Planner</span>
      </div>
      <div className="topbar-actions">
        <button
          className="btn-icon"
          onClick={() => setLang(lang === 'bg' ? 'en' : 'bg')}
          aria-label={t.language}
          title={t.language}
        >
          <span className="lang-label">{lang === 'bg' ? 'EN' : 'БГ'}</span>
        </button>
        <button
          className="btn-icon"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label={t.theme}
          title={theme === 'dark' ? t.themeLight : t.themeDark}
        >
          {theme === 'dark' ? <IconSun /> : <IconMoon />}
        </button>
        <button className="btn-icon" onClick={onRoutes} aria-label={t.myRoutes} title={t.myRoutes}>
          <IconFolder />
        </button>
        <button className="btn-icon" onClick={onNavLog} aria-label={t.navlog} title={t.navlog}>
          <IconTable />
        </button>
        <button className="btn-icon" onClick={onLayers} aria-label={t.layers} title={t.layers}>
          <IconLayers />
        </button>
      </div>
    </header>
  );
}
