import { useState } from 'react';
import { APP_AUTHOR, APP_COPYRIGHT, APP_NAME, APP_URL, CONTACT_EMAIL, feedbackMailto, LICENSE_URL } from '../config/app';
import { useT } from '../i18n';
import { useSettings } from '../store/settings';
import { shareText } from './share';

/** Share the app link — opens the phone's share sheet (Messenger, WhatsApp…) or copies the link. */
export function ShareAppButton({ className = 'btn-secondary' }: { className?: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: APP_NAME, text: t.shareAppText, url: APP_URL });
        return;
      } catch (e) {
        if ((e as DOMException)?.name === 'AbortError') return;
      }
    }
    if ((await shareText(APP_NAME, APP_URL)) === 'copied') {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };
  return (
    <button className={className} onClick={() => void share()}>
      {copied ? `✓ ${t.linkCopied}` : t.shareApp}
    </button>
  );
}

/** Author credit, licence, feedback and share — for the About section. */
export function Credits() {
  const t = useT();
  const lang = useSettings((s) => s.lang);
  return (
    <div className="credits">
      <p className="credit-line">
        <strong>{APP_NAME}</strong> — {t.createdBy} <strong>{APP_AUTHOR}</strong>
        <br />
        <span className="muted small">
          {APP_COPYRIGHT} · {t.licenceLbl}: <a href={LICENSE_URL} target="_blank" rel="noopener">PolyForm Noncommercial 1.0.0</a>
        </span>
      </p>
      <div className="fpl-actions">
        <ShareAppButton />
        {CONTACT_EMAIL && (
          <a className="btn-secondary" href={feedbackMailto(CONTACT_EMAIL, __APP_VERSION__, lang)}>✉ {t.feedback}</a>
        )}
      </div>
    </div>
  );
}
