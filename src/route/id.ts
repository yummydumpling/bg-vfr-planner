/** Short random id. crypto.randomUUID is unavailable on plain-http origins (e.g. LAN dev on iOS). */
export function newId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
      const b = crypto.getRandomValues(new Uint8Array(9));
      return Array.from(b, (x) => x.toString(36).padStart(2, '0')).join('').slice(0, 14);
    }
  } catch {
    /* fall through */
  }
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
