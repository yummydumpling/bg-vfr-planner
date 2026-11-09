import { useT } from '../i18n';
import { DISCLAIMER_VERSION, useSettings } from '../store/settings';
import { IconWarning } from './icons';

/** Always-visible strip at the bottom of every screen. */
export function DisclaimerBar() {
  const t = useT();
  return (
    <div className="disclaimer-bar" role="note">
      <IconWarning />
      <span>{t.disclaimerShort}</span>
    </div>
  );
}

/** First-launch acknowledgement (and again whenever the text version changes). */
export function DisclaimerModal() {
  const t = useT();
  const ack = useSettings((s) => s.disclaimerAck);
  const accept = useSettings((s) => s.ackDisclaimer);
  const { lang, setLang } = useSettings();
  if (ack >= DISCLAIMER_VERSION) return null;
  return (
    <div className="modal-backdrop">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="disc-title">
        <div className="modal-lang">
          <button className={lang === 'bg' ? 'chip active' : 'chip'} onClick={() => setLang('bg')}>Български</button>
          <button className={lang === 'en' ? 'chip active' : 'chip'} onClick={() => setLang('en')}>English</button>
        </div>
        <h2 id="disc-title"><IconWarning /> {t.disclaimerTitle}</h2>
        <p>{t.disclaimerBody}</p>
        <button className="btn-primary" onClick={accept} autoFocus>{t.disclaimerAccept}</button>
      </div>
    </div>
  );
}
