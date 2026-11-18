import { Component, type ErrorInfo, type ReactNode } from 'react';
import { CONTACT_EMAIL } from '../config/app';
import { getDict } from '../i18n';
import { useSettings } from '../store/settings';

interface State { error: Error | null; stack: string }

/** Replaces a blank page with a readable error screen and a "send report" e-mail. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, stack: '' };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ stack: `${error.stack ?? ''}\n${info.componentStack ?? ''}`.slice(0, 1500) });
  }

  render() {
    const { error, stack } = this.state;
    if (!error) return this.props.children;
    const lang = useSettings.getState().lang;
    const t = getDict(lang);
    const report = [
      `${t.errorReportIntro}`, '', `Version: ${__APP_VERSION__}`, `URL: ${location.href}`,
      `Device: ${navigator.userAgent}`, `Error: ${error.message}`, '', stack,
    ].join('\n');
    const mailto = CONTACT_EMAIL
      ? `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`BG VFR Planner error (${__APP_VERSION__})`)}&body=${encodeURIComponent(report)}`
      : null;
    return (
      <div className="crash">
        <div className="crash-box">
          <h1>{t.errorTitle}</h1>
          <p>{t.errorBody}</p>
          <pre>{error.message}</pre>
          <div className="fpl-actions">
            <button className="btn-primary inline" onClick={() => location.reload()}>{t.errorReload}</button>
            {mailto && <a className="btn-secondary" href={mailto}>{t.errorSend}</a>}
          </div>
          <p className="muted small">{t.disclaimerShort}</p>
        </div>
      </div>
    );
  }
}
