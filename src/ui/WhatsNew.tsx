import { useState } from 'react';
import { CHANGELOG, notesSince, type ReleaseNote } from '../changelog';
import { useT } from '../i18n';
import { useSettings } from '../store/settings';
import { IconClose } from './icons';

const KEY = 'bgvfr-seen-version';
const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const write = (v: string) => { try { localStorage.setItem(KEY, v); } catch { /* ignore */ } };

function Notes({ notes }: { notes: ReleaseNote[] }) {
  const lang = useSettings((s) => s.lang);
  return (
    <>
      {notes.map((n) => (
        <section key={n.version} className="wn-release">
          <h3>{n.version} <span className="muted small">{n.date}</span></h3>
          <ul>{n[lang].map((line, i) => <li key={i}>{line}</li>)}</ul>
        </section>
      ))}
    </>
  );
}

/** Shown once after the app updated to a newer version. */
export function WhatsNewAfterUpdate() {
  const t = useT();
  const ack = useSettings((s) => s.disclaimerAck);
  const [notes, setNotes] = useState<ReleaseNote[]>(() => {
    const current = __APP_VERSION__;
    let seen = read();
    if (!seen) {
      // Versions before 1.1 didn't record this: existing users (who already
      // accepted the disclaimer) are upgrading from 1.0; new installs see nothing.
      let existing = false;
      try { existing = !!localStorage.getItem('bgvfr-settings'); } catch { /* ignore */ }
      seen = existing ? '1.0.0' : current;
      if (!existing) write(current);
    }
    return notesSince(seen, current);
  });
  if (!notes.length || !ack) return null;
  const close = () => { write(__APP_VERSION__); setNotes([]); };
  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="wn-title" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <h2 id="wn-title">{t.whatsNew}</h2>
          <button className="btn-icon" onClick={close} aria-label={t.close}><IconClose /></button>
        </div>
        <Notes notes={notes} />
        <button className="btn-primary" onClick={close}>OK</button>
      </div>
    </div>
  );
}

/** Full history, for the About section. */
export function WhatsNewLink() {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn-text inline-link" onClick={() => setOpen(true)}>{t.whatsNew}</button>
      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="panel-head">
              <h2>{t.whatsNew}</h2>
              <button className="btn-icon" onClick={() => setOpen(false)} aria-label={t.close}><IconClose /></button>
            </div>
            <Notes notes={CHANGELOG} />
          </div>
        </div>
      )}
    </>
  );
}
