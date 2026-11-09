/**
 * Weather proxy base URL. Set VITE_WX_PROXY_URL at build time to the
 * deployed Cloudflare Worker; in development the Vite dev server proxies /wx.
 */
export const WX_PROXY_URL: string =
  (import.meta.env.VITE_WX_PROXY_URL as string | undefined) || (import.meta.env.DEV ? '/wx' : '');
