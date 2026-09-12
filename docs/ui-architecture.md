# Kensei Frontend — UI Architecture

Status: current as of the Angular 22 / Nothing Design consolidation (Phase 5).

## Stack

| Layer | Choice |
|-------|--------|
| Framework | Angular 22 (standalone components, signals, zoneless by default) |
| Build | `@angular/build:application` (esbuild) |
| Tests | `@angular/build:unit-test` + Vitest 4 (jsdom) |
| Language | TypeScript 6 (`module: preserve`, `moduleResolution: bundler`, strict templates) |
| Node | 24 (mise-managed; Angular does not support Node 26) |
| Styling | SCSS + Nothing Design tokens (no CSS-in-JS, no shadows/gradients) |
| PDF | `jspdf` (lazy-loaded) + `pako` (gzip BIN) |

Ports follow the XWA convention: frontend `4210`, backend `8010`
(`src/environments/environment.ts`; the host is resolved at runtime).

## Directory layout

```
frontend/
├── public/fonts/                # self-hosted woff2 (Doto, Space Grotesk, Space Mono)
├── scripts/test.sh              # npm test wrapper (`--run` accepted and ignored)
├── e2e/                         # real-browser smoke (Playwright) + fixtures
│   ├── browser_smoke.py
│   └── fixtures/                # rich HTML + fake CDNs + SPA routes (:8102)
└── src/
    ├── _fonts.scss              # @font-face declarations (imported by styles.scss)
    ├── styles.scss              # Nothing Design tokens + typography utilities
    ├── index.html               # no Google Fonts at runtime
    └── app/
        ├── app.component.*      # shell: sidebar nav, theme/locale toggles
        ├── app.config.ts        # provideRouter, provideHttpClient, global error listeners
        ├── app.routes.ts        # lazy `loadComponent` routes per feature
        ├── core/                # singleton, framework-level concerns
        │   ├── api.service.ts   # typed REST client (all HTTP goes through here)
        │   ├── live-event.ts    # xwa-sdk Event parsing + live-scan reducer (pure)
        │   ├── export.service.ts# client exports: JSON/CSV/PDF/BIN
        │   ├── i18n.service.ts  # en/es dictionaries + `{param}` interpolation
        │   └── theme.service.ts # dark/light signal, `kensei-theme` storage key
        ├── shared/              # reusable, presentation-only components
        │   ├── translate.pipe.ts
        │   ├── terminal/        # live log panel
        │   ├── metric-card/     # hero number + label (Doto)
        │   ├── status-badge/    # [ COMPLETED ] with status color
        │   ├── severity-tag/    # confidence/severity bracket tag
        │   ├── export-actions/  # client JSON/CSV/PDF/BIN + server JSON
        │   └── findings-list/   # divider-based item rows
        └── features/            # one folder per route
            ├── profiler/        # live WS scan dashboard
            ├── js-analysis/     # bundle dependencies + version DB
            ├── spa-routes/      # route map + guards
            ├── history/         # profiles, compare, trends, exports
            └── inventory/       # full profile report + exports
```

Rules:

- `core/` never imports from `features/`; `shared/` never injects state services.
- Every REST call is typed in `ApiService`; components never build URLs.
- WebSocket frames are parsed by `parseLiveEvent()` and folded with
  `applyLiveEvent()` — no socket logic inside the reducer, no protocol logic
  inside components.

## Runtime data flow

1. `ApiService` reads `environment.apiBaseUrl`/`wsBaseUrl` and exposes typed
   methods: `health`, `listProfiles`, `getProfile`, `deleteProfile`,
   `deleteAllProfiles`, `report`, `compare`, `trends`, `versionDb`,
   `exportJsonUrl`, `liveUrl`.
2. The profiler opens `liveUrl(target)`; each frame is `parseLiveEvent()`-d
   (malformed frames are ignored) and reduced into `LiveStats`
   (`analysis_started → analysis_progress → item_found* →
   analysis_completed|analysis_error`). The reducer also produces terminal log
   lines via `liveEventLogLine()`.
3. Zoneless change detection (app is Angular 22 **without zone.js**; there is no
   `polyfills` entry and no `provideZoneChangeDetection`). Any component that
   mutates plain properties inside an async callback **must** call
   `ChangeDetectorRef.markForCheck()` after every mutation; otherwise the view
   keeps the stale render until some unrelated user interaction happens
   (symptoms: `[ LOADING... ]` stuck, empty lists with data in the backend,
   values appearing only after a click). Rules:
   - inject `private readonly cdr = inject(ChangeDetectorRef);` in the component;
   - call `this.cdr.markForCheck()` in **both** `next` and `error` of every
     `HttpClient` subscription (and after awaited work, e.g. PDF export);
   - call it at the end of every WebSocket `onmessage`/event handler and in
     `finishLive()`-style follow-up subscriptions;
   - signals (theme, i18n locale) schedule their own updates and need nothing;
   - template event handlers run change detection themselves, so `markForCheck`
     is only needed for callback-driven mutations.
   Reference implementations: `features/profiler/profiler.component.ts`,
   `features/history/history.component.ts`, `features/inventory/inventory.component.ts`,
   `features/js-analysis/js-analysis.component.ts`, `features/spa-routes/spa-routes.component.ts`,
   `shared/export-actions/export-actions.component.ts`.

## Nothing Design rules in this app

- Tokens live only in `src/styles.scss`; `--gold` (#FFD700) is the only place the
  gold hex exists (hover accents).
- Fonts are self-hosted in `public/fonts` and declared in `src/_fonts.scss`;
  `index.html` has no Google Fonts links.
- No shadows, no skeletons, no emoji, no zebra striping; labels are Space Mono
  ALL CAPS (`.t-label`), the display font (Doto) is reserved for hero metrics.
- The dot-matrix motif (`radial-gradient` background) is the sanctioned
  exception; it is not UI chrome.
- Errors are inline bracket text (`[ ERROR: ... ]`), never toasts.

## i18n

`I18nService` holds `locale` (signal, persisted as `kensei-locale`), `t(key, params)`,
and the en/es dictionaries. Templates use the standalone `t` pipe
(`{{ 'nav.profiler' | t }}`, `{{ 'history.profilesCount' | t: { count: 3 } }}`).
Adding a language = adding a dictionary + one `Locale` union member.

## Exports

| Scope | Client-side | Server-side |
|-------|-------------|-------------|
| Profile detail (inventory) | JSON, CSV (flat record types), PDF (lazy jsPDF), BIN (gzip) | `GET /api/profiles/{id}/export/json` |
| History list | JSON, CSV (list) | per-profile JSON via the same endpoint |

`ExportService` owns the download plumbing (Blob → object URL → anchor);
pure builders (`profileCsv`, `profilesCsv`, `escapeCsvCell`) are unit-tested.

## Testing

`npm test` builds the app for the test target and runs Vitest once
(`scripts/test.sh` maps `--run` for suite consistency). Coverage:

- `core/api.service.spec.ts` — every endpoint, query encoding, live URL auth token.
- `core/live-event.spec.ts` — frame parsing, reducer transitions, log lines.
- `core/export.service.spec.ts` — CSV builders and blob downloads.
- `core/i18n.service.spec.ts` — locale toggle, interpolation, persistence.
- `features/history/history.component.spec.ts` — compare, trends, list exports.
- `app.spec.ts` + `shared/shared-components.spec.ts` — shell and shared tags.

Real-browser coverage lives in `e2e/browser_smoke.py` (Playwright): it runs a
live profile against the fixture and asserts that phases, counters,
technologies, history rows, compare, trends, inventory, JS analysis and SPA
routes render **without extra interaction**, with zero console/page errors.
See `e2e/README.md` for the fixture and stack setup.

## Commands

```bash
export PATH="$HOME/.local/share/mise/installs/node/24/bin:$PATH"
npm ci
npm test
npm run build
npm audit --omit=dev
npm start          # dev server on 0.0.0.0:4210

# Browser smoke (stack + fixture must be up, see e2e/README.md)
/home/x/Documents/xwebanalysis/samurai/backend/.venv/bin/python e2e/browser_smoke.py
```
