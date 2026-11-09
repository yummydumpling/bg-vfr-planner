import { useState } from 'react';
import { useT } from '../i18n';
import { copyText } from './share';

export function CopyButton({ text, label, className = 'btn-copy' }: { text: string; label?: string; className?: string }) {
  const t = useT();
  const [done, setDone] = useState(false);
  return (
    <button
      className={className}
      onClick={async () => {
        if (await copyText(text)) {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        }
      }}
    >
      {done ? `✓ ${t.copied}` : label ?? t.copy}
    </button>
  );
}
