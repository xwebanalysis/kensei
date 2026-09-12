# Kensei — Browser E2E smoke (`browser_smoke.py`)

Real-Chromium regression guard for the Angular 22 **zoneless** change-detection
contract (see `docs/ui-architecture.md`). It drives the actual UI and asserts
that async data renders **without any extra user interaction** after each
operation — the exact failure mode of a missing `ChangeDetectorRef.markForCheck()`.

## What it covers

| Area | Assertions |
|------|------------|
| Profiler (live WS) | SCAN against the fixture; 4/4 phases DONE, metric counters > 0, report findings render, react/angular detected — all with zero further clicks |
| History | Profile rows visible on entry (no click), first row shows the target |
| Compare | Select 2 profiles, compare panel renders findings |
| Trends | Chart path + legend render after LOAD TRENDS |
| Inventory | Deep link `?id=N` renders header + findings |
| JS analysis | Selecting a profile renders dependency rows (lodash visible) |
| SPA routes | Selecting a profile renders the route map + auth guards |
| Console | No `console.error` and no `pageerror` for the whole run |

## Prerequisites

* Backend venv with Playwright (used for the script):
  `/home/x/Documents/xwebanalysis/samurai/backend/.venv/bin/python`
  (Playwright 1.62 + Chromium already installed).
* Kensei stack running locally (`./kensei.sh local`): frontend `:4210`,
  backend `:8010`.
* Fixture server on `:8102` with rich HTML, fake CDNs and SPA routes.
  The fixture source lives in `e2e/fixtures/`; serve it from
  `/tmp/opencode/fixture-ken` (per the E2E convention):

```bash
mkdir -p /tmp/opencode/fixture-ken
cp -r e2e/fixtures/. /tmp/opencode/fixture-ken/
python3 -m http.server 8102 --directory /tmp/opencode/fixture-ken &
```

The fixture exposes:

* `index.html` — `<app-root ng-version>`, `react@18.2.0` /
  `jquery@3.6.0` / `lodash@4.17.21` script URLs, `preload` of the bundle.
* `assets/app.bundle.js` — `path: 'login'`, `path: 'dashboard'`,
  `canActivate: [AuthGuard]`, `createBrowserRouter`, `ProtectedRoute`,
  `ModuleFederationPlugin`, `__webpack_require__`, `sourceMappingURL`.
* `plain.html` — minimal page used as the second profile so compare finds
  real changes.

## Run

```bash
cd /home/x/Documents/xwebanalysis/kensei
/home/x/Documents/xwebanalysis/samurai/backend/.venv/bin/python e2e/browser_smoke.py
```

Environment overrides: `KENSEI_FRONTEND_URL`, `KENSEI_BACKEND_URL`,
`KENSEI_FIXTURE_URL`. Exit code is non-zero if any check fails.

Expected tail:

```
PASS: 18/18 checks
```

## Notes

* The script performs no interaction while waiting for async state; only the
  initial form fill/click. That is deliberate: it reproduces the user-visible
  zoneless bug (`[ LOADING... ]` stuck / empty lists).
* The `<path class="trend-line">` check waits for a non-empty `d` attribute
  because Chromium reports an empty bounding box for `fill:none` SVG
  polylines/paths, which Playwright treats as "hidden".
