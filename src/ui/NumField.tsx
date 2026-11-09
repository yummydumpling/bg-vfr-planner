import { useEffect, useId, useState } from 'react';

interface Props {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  /** Allow decimals (comma or dot). */
  decimal?: boolean;
  error?: string;
  /** Normalise on blur, e.g. wrap 360 → 0 for directions. */
  normalize?: (v: number) => number;
  compact?: boolean;
}

/**
 * Mobile-friendly numeric input: numeric keypad, accepts "," as decimal
 * separator (Bulgarian keyboards), keeps the raw text while typing.
 */
export function NumField({ label, value, onChange, suffix, decimal = false, error, normalize, compact }: Props) {
  const id = useId();
  const [text, setText] = useState(fmt(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(fmt(value));
  }, [value, focused]);

  const parse = (s: string) => {
    const n = Number(s.replace(',', '.').trim());
    return s.trim() === '' ? Number.NaN : n;
  };

  return (
    <label className={`field${compact ? ' compact' : ''}${error ? ' has-error' : ''}`} htmlFor={id}>
      <span className="field-label">{label}</span>
      <span className="field-input">
        <input
          id={id}
          inputMode={decimal ? 'decimal' : 'numeric'}
          enterKeyHint="done"
          autoComplete="off"
          value={text}
          aria-invalid={!!error}
          onFocus={(e) => { setFocused(true); e.currentTarget.select(); }}
          onChange={(e) => {
            setText(e.target.value);
            const n = parse(e.target.value);
            if (Number.isFinite(n)) onChange(n);
            else onChange(Number.NaN);
          }}
          onBlur={() => {
            setFocused(false);
            const n = parse(text);
            if (Number.isFinite(n) && normalize) onChange(normalize(n));
          }}
        />
        {suffix && <span className="field-suffix">{suffix}</span>}
      </span>
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}

const fmt = (v: number) => (Number.isFinite(v) ? String(v) : '');
