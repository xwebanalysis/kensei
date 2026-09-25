
<h1 align="center">Kensei</h1>

<div align="center">
<img src="https://raw.githubusercontent.com/xscriptor/xassets/main/xwa/kensei/kensei-colors.svg" width="120"/> 
</div>

**Language / Idioma**  
English

<p><em><a href="https://github.com/xwebanalysis/kensei">Kensei</a></em> : <em><a href="https://github.com/xwebanalysis/meta">XWA</a>  <strong>submodule focused</strong> on web technology stack profiling — under active development</em></p>

<hr>

<h2>Overview</h2>

<p>Kensei is a web technology stack profiler with two interfaces sharing the same database:</p>

<table>
  <tr>
    <th>Interface</th>
    <th>Directory</th>
    <th>Language</th>
    <th>Type</th>
  </tr>
  <tr>
    <td><strong>Kensei Web</strong></td>
    <td><code>/frontend</code> + <code>/backend</code></td>
    <td>Angular 22 + FastAPI/Python</td>
    <td>Web application (local SQLite or Docker/PostgreSQL)</td>
  </tr>
</table>

<h3>Capabilities</h3>
<ul>
  <li><strong>Server Fingerprinting</strong> — HTTP header analysis, SSL/TLS handshake profiling, server banner detection, CDN detection</li>
  <li><strong>JS Bundle Analysis</strong> — Dependency extraction, version detection, library fingerprinting from JavaScript bundles and source maps</li>
  <li><strong>SPA Route Discovery</strong> — Angular/React/Vue route enumeration, lazy-loaded module detection, client-side path mapping, auth guards</li>
  <li><strong>Technology Inventory</strong> — Full stack composition report (frontend frameworks, backend servers, CDN, analytics, third-party services)</li>
  <li><strong>History &amp; Archive</strong> — Persistent profile storage, profile comparison and domain trends over time</li>
  <li><strong>Live Stream</strong> — WebSocket progress using the shared xwa-sdk <code>Event</code> envelope</li>
  <li><strong>Exports</strong> — Client-side JSON/CSV/PDF/BIN plus server-side JSON attachment per profile</li>
  <li><strong>UI</strong> — Nothing Design (Doto + Space Grotesk + Space Mono, self-hosted), dark/light, en/es i18n</li>
</ul>

<hr>

<h2>Quick Start</h2>

<h3>Local (SQLite — zero infra, default)</h3>
<pre><code>./kensei.sh</code></pre>
<ul>
  <li>Frontend: <code>http://localhost:4210</code></li>
  <li>Backend API docs: <code>http://localhost:8010/docs</code></li>
  <li>Database: <code>kensei.db</code> (SQLite, created on first run)</li>
</ul>

<h3>Docker Compose (PostgreSQL)</h3>
<pre><code>./kensei.sh docker</code></pre>
<ul>
  <li>Frontend: <code>http://localhost:4210</code></li>
  <li>API docs: <code>http://localhost:8010/docs</code></li>
</ul>

<h3>Launch Script (kensei.sh)</h3>
<p>The <code>kensei.sh</code> script handles all launch modes, dependency setup and the local <code>xwa-sdk</code> install:</p>

<table>
  <tr><th>Command</th><th>Mode</th><th>Infrastructure</th><th>Use case</th></tr>
  <tr>
    <td><code>./kensei.sh</code> / <code>./kensei.sh local</code></td>
    <td>Native (SQLite)</td>
    <td>None — zero infra (default)</td>
    <td>Fast dev, no Docker needed</td>
  </tr>
  <tr>
    <td><code>./kensei.sh local backend</code></td>
    <td>Native backend only</td>
    <td>None — SQLite at <code>&lt;repo&gt;/kensei.db</code></td>
    <td>API work</td>
  </tr>
  <tr>
    <td><code>./kensei.sh docker</code></td>
    <td>Docker Compose</td>
    <td>PostgreSQL container</td>
    <td>Production-like, isolated</td>
  </tr>
  <tr>
    <td><code>--sqlite</code> / <code>--native</code> / <code>--native-no-infra</code> / <code>--fast</code></td>
    <td colspan="3">Legacy aliases for <code>local</code></td>
  </tr>
</table>

<p>Press <kbd>Ctrl+C</kbd> to stop all services cleanly.</p>

<h3>Cleanup (clean.sh)</h3>
<pre><code>./clean.sh</code></pre>
<p>Kills leftover processes, removes Docker containers/volumes/images, deletes <code>node_modules/</code>, <code>.venv</code>, <code>dist/</code>, Python cache, and <code>.angular/</code> cache. <code>package-lock.json</code> is preserved.</p>

<hr>

<h2>Security</h2>

<p>CORS is restricted to localhost/LAN by default, rate limiting is always on, and JWT authentication with role-based access control is optional (off unless <code>KENSEI_JWT_SECRET</code> is set):</p>

<table>
  <tr><th>Variable</th><th>Default</th><th>Description</th></tr>
  <tr><td><code>XWA_CORS_ORIGINS</code></td><td>unset</td><td>Comma-separated exact origins, or <code>*</code>. Unset allows localhost/LAN (<code>allow_credentials=False</code>)</td></tr>
  <tr><td><code>KENSEI_JWT_SECRET</code></td><td>unset</td><td>When set, all <code>/api/*</code> routes and the live WebSocket require an HS256 Bearer token (24h). Unset = auth and RBAC fully disabled</td></tr>
  <tr><td><code>KENSEI_ADMIN_PASSWORD</code></td><td><code>changeme</code></td><td>Admin password accepted by <code>POST /api/auth/login</code> (only while <code>KENSEI_JWT_SECRET</code> is set)</td></tr>
  <tr><td><code>KENSEI_RATE_LIMIT_MAX</code></td><td><code>120</code></td><td>Requests per client IP per 60 s window (<code>429</code> when exceeded); <code>/api/health</code> is exempt</td></tr>
</table>

<p>Tokens carry <code>sub</code> + <code>role</code> claims (<code>admin</code> | <code>analyst</code>). <code>/api/auth/login</code>
issues <code>admin</code> tokens. Destructive routes — <code>DELETE /api/profiles</code>,
<code>DELETE /api/profiles/{id}</code> and <code>POST /api/profiles/{id}/cancel</code> — require the
<code>admin</code> role; <code>analyst</code> tokens get <code>403</code> there but may read everything else.
<code>/api/health</code> and <code>/</code> stay exempt. The legacy <code>POST /api/auth/token</code> endpoint and
<code>KENSEI_AUTH_PASSWORD</code> env var remain as deprecated aliases. With <code>KENSEI_JWT_SECRET</code>
unset, every route behaves exactly as without auth.</p>

<pre><code>export KENSEI_JWT_SECRET=change-me
export KENSEI_ADMIN_PASSWORD=change-me-too
curl -X POST http://localhost:8010/api/auth/login \
  -H 'Content-Type: application/json' -d '{"password":"change-me-too"}'
# use the returned token over HTTP:
curl -H 'Authorization: Bearer &lt;token&gt;' http://localhost:8010/api/profiles
# and over WebSocket:
# ws://localhost:8010/api/profile/live?target=example.com&amp;token=&lt;token&gt;</code></pre>

<hr>

<h2>Related Documents</h2>

<table>
  <tr><th>Document</th><th>Description</th></tr>
  <tr><td><a href="docs/README.md">docs/</a></td><td>Architecture, API reference and development guide</td></tr>
  <tr><td><a href="docs/ui-architecture.md">docs/ui-architecture.md</a></td><td>Frontend structure (core/shared/features), i18n, exports and tests</td></tr>
  <tr><td><a href="ROADMAP.md">ROADMAP.md</a></td><td>Development phases and milestones</td></tr>
</table>

<hr>

<h2>Project Structure</h2>

<pre><code>kensei/
├── frontend/              # Angular 22 SPA (zoneless, core/shared/features, Vitest)
│   ├── public/fonts/      # self-hosted Nothing fonts (no Google Fonts at runtime)
│   └── src/app/           # core/ (api, live-event, export, i18n, theme), shared/, features/
├── backend/               # FastAPI Python (REST + WebSocket)
│   ├── app/
│   │   ├── main.py        # API routes, health, WebSocket endpoint
│   │   ├── database.py    # SQLAlchemy engine (SQLite default / PostgreSQL)
│   │   ├── events.py      # xwa-sdk Event envelope + EventStream emitter
│   │   ├── models.py      # Profile, Technology, DiscoveredRoute, JsDependency
│   │   ├── profiler.py    # Four-phase profiling orchestrator
│   │   ├── security.py    # Optional JWT + rate limiting
│   │   └── modules/       # ssl_tls, server_fingerprint, js_analyzer, spa_discovery
│   ├── tests/             # pytest suite (tmp SQLite, no network)
│   ├── requirements.txt   # runtime pins (Python 3.13)
│   ├── requirements-postgres.txt
│   └── requirements-dev.txt
├── docs/                  # Technical documentation
├── kensei.sh              # Launch script (local default / docker)
├── clean.sh               # Cleanup script
└── docker-compose.yml     # 3 services: frontend, backend, postgres
</code></pre>

<div id="x" align="center">
<h2>X</h2>

<a href="https://dev.xscriptor.com">
  <img src="https://xscriptor.github.io/icons/icons/code/product-design/xsvg/verified-filled.svg" width="24" alt="X Web" />
</a>
 & 
<a href="https://github.com/xscriptor">
  <img src="https://xscriptor.github.io/icons/icons/code/product-design/xsvg/github.svg" width="24" alt="X Github Profile" />
</a>
 & 
<a href="https://www.xscriptor.com">
  <img src="https://xscriptor.github.io/icons/icons/code/product-design/xsvg/quotes.svg" width="24" alt="Xscriptor web" />
</a>

</div>
