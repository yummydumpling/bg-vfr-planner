/** App identity, credit and contact — shown in the app and used for sharing. */
export const APP_NAME = 'BG VFR Planner';
export const APP_AUTHOR = 'Vincent Marchewka';
export const APP_COPYRIGHT = `© 2026 ${APP_AUTHOR}`;
export const APP_URL = 'https://yummydumpling.github.io/bg-vfr-planner/';
export const REPO_URL = 'https://github.com/yummydumpling/bg-vfr-planner';
export const LICENSE_URL = `${REPO_URL}/blob/main/LICENSE`;

/**
 * Feedback/contact address, set by the owner at build time in .env.production
 * (VITE_CONTACT_EMAIL=…). The feedback link is hidden when it's not set.
 */
export const CONTACT_EMAIL: string = ((import.meta.env.VITE_CONTACT_EMAIL as string | undefined) ?? '').trim();

/** mailto: link for feedback, pre-filled with version and device info. */
export function feedbackMailto(email: string, version: string, lang: string): string {
  const subject = `${APP_NAME} feedback (${version})`;
  const body = lang === 'bg'
    ? `\n\n---\nВерсия: ${version}\nУстройство: ${navigator.userAgent}`
    : `\n\n---\nVersion: ${version}\nDevice: ${navigator.userAgent}`;
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
