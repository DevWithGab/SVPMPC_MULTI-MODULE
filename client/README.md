# SVPMPC client

## Progressive web app

The production build includes a web app manifest, branded installation icons,
an Apple touch icon, and a service worker with an offline fallback page.
PWA settings live in `vite.config.js`, using `vite-plugin-pwa` with the
`injectManifest` strategy. Vite generates the manifest, injects its HTML link
and service worker registration, and builds `src/sw.js` with a content revision
for the offline page. Edit the app name, colors, icons and cache inclusion there.
Installation uses the browser's Install app / Add to Home Screen menu.
On iPhone or iPad, open the site in Safari and use Share → Add to Home Screen.

The app still requires the backend for login, attendance and financial operations.
Only the public offline page and manifest are stored in the service worker cache. API responses
and authenticated pages are not cached, and transactions are not queued offline.
The fallback appears when a page navigation fails after the worker has installed;
it does not replace an already open screen when connectivity changes.

### Build and check

```sh
npm run build
npm run preview
```

Open the localhost preview, then inspect Application → Manifest and Service Workers
in browser developer tools. Wait for the worker to activate, switch the browser
to offline, and reload a portal URL: the offline page should appear. Reconnect
and select **Try again** to return to that URL. Check installation on a supported
desktop browser and on a mobile device. `npm run dev` does not register the worker.
If using the same origin for development and preview, unregister the preview
worker in developer tools before development.

### Hosting

- Serve `dist` at the domain root over HTTPS (localhost also works for testing).
- Serve `/sw.js`, `/registerSW.js`, `/offline.html`, `/manifest.webmanifest` and `/pwa/*` as actual
  static files before applying the SPA fallback to `/index.html` for portal URLs.
- Use `Cache-Control: no-cache` for `/sw.js`, `/registerSW.js`, `/offline.html`,
  `/manifest.webmanifest` and `/index.html` so deployments are revalidated.
- Serve the manifest as `application/manifest+json` and the worker as JavaScript.
- Keep the backend reachable over HTTPS from the installed app.
- Vite versions the offline cache automatically when `public/offline.html` changes.
  Updated workers activate once existing app windows close, avoiding mid-form reloads.

## Vite template notes

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is enabled on this template. See [this documentation](https://react.dev/learn/react-compiler) for more information.

Note: This will impact Vite dev & build performances.

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
