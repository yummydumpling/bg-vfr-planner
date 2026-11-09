import { useT } from '../i18n';
import { useUpdates } from '../pwa/updates';

/** Non-blocking notice when a new version is ready but we didn't reload mid-use. */
export function UpdateBar() {
  const t = useT();
  const pending = useUpdates((s) => s.pending);
  const apply = useUpdates((s) => s.apply);
  if (!pending) return null;
  return (
    <div className="update-bar" role="status">
      <span>{t.updateReady}</span>
      <button onClick={apply}>{t.updateNow}</button>
    </div>
  );
}
