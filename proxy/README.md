# Weather proxy (Cloudflare Worker)

aviationweather.gov does not send CORS headers, so the browser blocks the app
from reading METAR/TAF directly. `worker.js` is a ~100-line Cloudflare Worker
that forwards **only** METAR/TAF requests for valid ICAO codes, **only** for
the app's own origins (see `ALLOWED_ORIGINS`), and caches answers for 2 minutes.

API (same shape as aviationweather.gov's JSON):

```
GET https://<worker>.workers.dev/metar?ids=LBSF,LBPD
GET https://<worker>.workers.dev/taf?ids=LBSF
```

## Deploy from the Cloudflare dashboard (no tools needed)

1. Create a free account at <https://dash.cloudflare.com/sign-up> and verify your e-mail.
2. Open **Workers & Pages** → **Create** → **Create Worker** (the "Hello World" starter).
   Name it `bg-vfr-weather` and click **Deploy**. (The first time, Cloudflare asks you
   to pick a `*.workers.dev` subdomain.)
3. Click **Edit code**, delete everything in `worker.js`, paste the contents of
   [`proxy/worker.js`](https://raw.githubusercontent.com/yummydumpling/bg-vfr-planner/main/proxy/worker.js),
   and click **Deploy**.
4. Test in a browser: `https://bg-vfr-weather.<subdomain>.workers.dev/metar?ids=LBSF`
   should show JSON text with the current Sofia METAR.
5. Build the app with the worker URL:
   ```bash
   VITE_WX_PROXY_URL=https://bg-vfr-weather.<subdomain>.workers.dev npm run build
   ```

## Deploy with Wrangler (CLI)

```bash
cd proxy
npx wrangler deploy
```

## Limits & etiquette

- Cloudflare free plan: 100 000 requests/day.
- aviationweather.gov: max 100 requests/min; the 2-minute cache and the app's
  5-minute re-fetch limit keep usage far below that.
- If the app is served from another address, add it to `ALLOWED_ORIGINS`.
