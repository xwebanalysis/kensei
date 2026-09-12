# Kensei Development Roadmap

This document tracks the strategic steps required to evolve the Kensei application into a full-scale web technology stack profiler.
This file is formatted to be synced automatically with GitHub Issues using the `xgh` roadmap standard.

## Infrastructure & Core Initialization <!-- phase:infrastructure -->

- [x] Dockerize frontend (Angular) and backend (FastAPI) environments
- [x] Implement the Nothing Design System UI tokens and layout
- [x] Configure Docker-compose for rapid local development (HMR support)
- [x] Adopt SQLite-first persistence (`DB_DRIVER=sqlite`, WAL) with PostgreSQL as an opt-in compose mode

## Server Fingerprinting <!-- phase:server-fingerprint -->

- [x] Scaffold SQLAlchemy models for Profiles, Technologies, Routes and JS dependencies
- [x] Create WebSocket endpoints for the real-time profiling stream
- [x] Implement HTTP header analysis (Server, X-Powered-By, CDN headers)
- [x] Build SSL/TLS handshake profiler (certificate analysis, cipher suites)
- [x] Detect CDN, WAF, and reverse proxy layers

## JS Bundle Analysis <!-- phase:js-analysis -->

- [x] Implement JavaScript bundle download and parsing
- [x] Build dependency extraction from source maps (inline and external)
- [x] Create library fingerprint database with version detection
- [x] Detect build tools (webpack, vite, esbuild, rollup) and their versions
- [x] Analyze module federation and dynamic imports

## SPA Route Discovery <!-- phase:spa-routes -->

- [x] Implement Angular router pattern extraction (lazy-loaded modules, guards)
- [x] Detect React Router route definitions and nested layouts
- [x] Discover Vue Router configuration and named views
- [x] Build client-side route map visualization
- [x] Detect authentication guards and protected routes

## Technology Inventory & Reporting <!-- phase:inventory -->

- [x] Build full stack composition report generator
- [x] Implement version mismatch and outdated dependency detection
- [x] Create JSON export for technology profiles
- [x] Add change detection over time (diff between scans)
- [x] Build historical trend visualization

## Production Hardening <!-- phase:production-hardening -->

- [x] Wrap FastAPI backend routes with JWT Authentication middleware
- [ ] Add RBAC to restrict profiling actions by user level
- [x] Implement rate limiting and access controls
- [x] Remove unused Redis/Celery/`sourcemap` dependencies (SQLite-first, reproducible pins)

## XWA Contract & Quality <!-- phase:xwa-contract -->

- [x] Emit xwa-sdk `Event` envelopes over the live WebSocket (`seq`, persisted `analysis_id`, UTC `ts`, payload)
- [x] Add `GET /api/health` with `{"status","database","version","tool"}` and migrate startup to FastAPI lifespan
- [x] Fix REST route shadowing: `/api/profiles/compare` and `/api/profiles/trends` resolve before `/{profile_id}` (aliases `/api/compare`, `/api/trends`)
- [x] Standardize XWA ports: backend `:8010`, frontend `:4210`
- [x] `environment.ts` + `ApiService`; no hardcoded `hostname:8000`
- [x] Backend pytest suite (health, profiles CRUD, export, report, compare/trends, modules with mocked HTTP)
- [x] Technical docs (`docs/`) and corrected README

## Frontend Modernization — Angular 22 + Nothing <!-- phase:frontend-modernization -->

- [x] Upgrade Angular 21.2 → 22.1 + TypeScript 6 + `@angular/build`/CLI 22, Node 24 reproducible (`package-lock.json`, `npm ci`)
- [x] Zoneless change detection (no `zone.js`), `provideBrowserGlobalErrorListeners`
- [x] Restructure to `core/` (api, live-event, export, i18n, theme), `shared/` (terminal, metric-card, status-badge, severity-tag, export-actions, findings-list) and `features/`
- [x] Real i18n (en/es) behind the existing `t` pipe, persisted locale, translated templates
- [x] Nothing Design cleanup: `--gold` token (no hardcoded `#FFD700`), no shadows/skeletons/emoji, Space Mono ALL CAPS labels
- [x] Self-hosted fonts (Doto, Space Grotesk, Space Mono) in `public/fonts`; Google Fonts removed from `index.html`
- [x] Centralized REST/WS parsing (typed `ApiService`, `parseLiveEvent`/`applyLiveEvent` reducer)
- [x] Consistent exports: inventory client JSON/CSV/PDF/BIN + server JSON; history list JSON/CSV + per-profile server JSON
- [x] Vitest suite expanded (ApiService, WS Event parsing, compare/trends, exports, i18n, shared tags) and `npm audit --omit=dev` clean
- [x] `docs/ui-architecture.md` + README/ROADMAP updated
