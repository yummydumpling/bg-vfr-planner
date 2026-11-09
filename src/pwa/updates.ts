/**
 * Automatic app updates for the installed PWA.
 *
 * The service worker installs new versions immediately (skipWaiting +
 * clientsClaim). This module decides when the *page* reloads onto the new
 * version so the pilot is never interrupted mid-task:
 *  - update found while the app is opening/resuming → reload right away
 *  - update found later while in use → show a small "Update" bar and
 *    reload automatically the next time the app comes back to the foreground
 * It also checks for updates on launch, on every resume and every 30 min,
 * because iOS home-screen apps are often resumed rather than relaunched.
 */
import { registerSW } from 'virtual:pwa-register';
import { create } from 'zustand';

const CHECK_INTERVAL_MS = 30 * 60 * 1000;
/** An update found this soon after launch/resume is applied immediately. */
const SAFE_WINDOW_MS = 20 * 1000;

interface UpdateState {
  pending: boolean;
  apply: () => void;
}

export const useUpdates = create<UpdateState>()(() => ({
  pending: false,
  apply: () => window.location.reload(),
}));

let lastForeground = Date.now();

export function initAutoUpdates() {
  if (!('serviceWorker' in navigator)) return;
  let registration: ServiceWorkerRegistration | undefined;

  const check = () => {
    if (!registration || !navigator.onLine) return;
    registration.update().catch(() => undefined);
  };

  registerSW({
    immediate: true,
    onNeedReload() {
      // New version has taken control of this page.
      if (document.visibilityState === 'visible' && Date.now() - lastForeground < SAFE_WINDOW_MS) {
        window.location.reload();
      } else {
        useUpdates.setState({ pending: true });
      }
    },
    onRegisteredSW(_url, reg) {
      registration = reg;
      if (reg) setInterval(check, CHECK_INTERVAL_MS);
    },
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    lastForeground = Date.now();
    if (useUpdates.getState().pending) {
      window.location.reload();
      return;
    }
    check();
  });
  window.addEventListener('online', check);
}
