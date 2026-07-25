# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Life Log** — a personal life tracking web app with three modules: Moment, Fitness, and Assets. Deployed via Cloudflare. No build step, no framework, no server required — plain HTML/CSS/JavaScript.

## Repository Structure

```
(repo root)
├── index.html          ← home/hub page (links to all modules)
├── shared/
│   ├── style.css       ← design tokens + shared components
│   ├── nav.js          ← renderNav(activePage) — site-wide nav bar
│   ├── auth.js         ← Google OAuth helpers
│   ├── drive.js        ← createDriveStore(folderPath, onAuthFailure)
│   └── mockDrive.js    ← createMockStore(folderPath) — HTTP fetch from MockDrive/
├── MockDrive/          ← static demo data, committed to repo, served by Cloudflare
│   └── lifeLog/        ← mirrors the Google Drive folder structure exactly
│       ├── config.json
│       ├── fitness/
│       │   ├── 2026.json
│       │   ├── goals.json
│       │   └── plan.json
│       └── moment/
├── moment/
│   ├── index.html      ← Moment module (daily log)
│   └── CLAUDE.md
├── fitness/
│   ├── index.html      ← Fitness module
│   └── CLAUDE.md
└── assets/
    ├── index.html      ← Assets module
    └── CLAUDE.md
```

## Running the App

**Production:** Deployed on Cloudflare Pages. Open `https://<domain>/fitness/` etc. No server needed.

**Local dev:** Must use a local HTTP server — `fetch()` is blocked on `file://` protocol.
```
npx serve .
# then open http://localhost:3000/fitness/
```

No lint, build, or test commands.

## Shared Infrastructure

All modules import from `shared/`:

### `style.css`
Design tokens (dark theme):
```
--bg: #0f0f0f    --surface: #1a1a1a    --surface2: #222
--border: #2a2a2a    --text: #e0e0e0    --muted: #666    --accent: #6c8ebf
--M: #f59e0b  --A: #10b981  --I: #c084fc  --F: #f472b6  --H: #22d3ee
```
Provides: `.btn`, `.btn.primary`, `.toast`, `.auth-overlay`, `.site-nav`

### `nav.js`
```js
import { renderNav } from '../shared/nav.js';
renderNav('moment'); // or 'fitness' | 'assets' | ''
```
Prepends the site-wide nav bar (`<div class="site-nav">`) to `<body>`. Brand shows "Life Log".

### `auth.js`
```js
import { loadStoredToken, initAuth, signIn, signOut, getAccessToken } from '../shared/auth.js';
```
Handles Google OAuth token lifecycle, localStorage caching, and silent refresh.

### `drive.js`
```js
import { createDriveStore } from '../shared/drive.js';
// folderPath supports nested paths — resolves/creates each level in Drive
const store       = createDriveStore('lifeLog/fitness', onAuthFailure);
const sharedStore = createDriveStore('lifeLog', onAuthFailure);
// store.readJson(filename)       → parsed object, or null if not found
// store.writeJson(filename, data, onError)
// store.clearCache()
```

### `mockDrive.js`
```js
import { createMockStore } from '../shared/mockDrive.js';
// Reads static JSON from MockDrive/ via HTTP fetch (requires a local server or Cloudflare Pages)
// Writes are held in memory only — lost on refresh, suitable for demo
const store = createMockStore('lifeLog/fitness');
// Same interface: store.readJson / store.writeJson / store.clearCache
```

## Drive Folder Structure

All modules store data under `lifeLog/` in the user's Google Drive. `MockDrive/` in the repo mirrors this structure exactly:

```
Drive root (or MockDrive/)
└── lifeLog/
    ├── config.json              ← shared: { "geminiKey": "..." }
    ├── fitness/
    │   ├── 2026.json            ← training entries keyed by date
    │   ├── goals.json
    │   └── plan.json
    ├── moment/
    │   └── 2026.json
    └── assets/
        ├── holdings.json
        └── transactions_2026.json
```

## Three-Mode Init Pattern

Every module's `init()` follows this pattern — logged-in users get Google Drive, everyone else gets MockDrive demo mode:

```js
import { loadStoredToken, initAuth, signIn } from '../shared/auth.js';
import { createDriveStore } from '../shared/drive.js';
import { createMockStore }  from '../shared/mockDrive.js';

let store = null, sharedStore = null;
let geminiKey = null, isDemoMode = false;

async function init() {
  renderNav('moduleName');
  // ... render static UI ...

  const stored = loadStoredToken();
  if (stored) {
    await initAuth({ onSignedIn: activateStore, onSignOut: startDemoMode });
  } else {
    await startDemoMode();
  }
}

async function activateStore() {
  const onAuthFail = () => document.getElementById('auth-ov').classList.remove('gone');
  sharedStore = createDriveStore('lifeLog', onAuthFail);
  store       = createDriveStore('lifeLog/moduleName', onAuthFail);
  // read data from Drive ...
  const config = await sharedStore.readJson('config.json');
  if (config?.geminiKey) geminiKey = config.geminiKey;
  document.getElementById('auth-ov').classList.add('gone');
  renderAll();
}

async function startDemoMode() {
  isDemoMode = true;
  const mockStore = createMockStore('lifeLog/moduleName');
  // read data from MockDrive ...
  document.getElementById('auth-ov').classList.add('gone');
  document.getElementById('demo-banner').style.display = 'flex';
  renderAll();
}

async function doSignIn() {
  await signIn(activateStore);
}
```

**HTML requirements:**
```html
<!-- Auth overlay: starts hidden, shown only when Drive auth fails -->
<div id="auth-ov" class="gone auth-overlay">
  <button onclick="doSignIn()">登入 Google</button>
</div>

<!-- Demo banner: starts hidden, shown in demo mode -->
<div id="demo-banner">
  <strong>Demo 模式</strong>
  <span>範例資料，變更不會儲存</span>
  <button onclick="doSignIn()">登入 Google 啟用完整功能</button>
</div>
```

**Key rules:**
- `auth-ov` must start with `class="gone"` in HTML — only shown on Drive auth failure
- `demo-banner` CSS default is `display: none` — set `style.display = 'flex'` to show
- `saveData()` must check `if (isDemoMode) return` to skip writes in demo mode
- MockDrive writes are in-memory only; real Drive writes go through `store.writeJson()`
- Gemini key comes from `sharedStore.readJson('config.json')` — shared across all modules

## Modules

### Moment (`moment/`)
Records daily events tagged M/A/I/F/H. Data: `lifeLog/moment/{year}.json`. See `moment/CLAUDE.md`.

### Fitness (`fitness/`)
Exercise tracking, training load (ACWR), competition planning. Data: `lifeLog/fitness/`. See `fitness/CLAUDE.md`.

### Assets (`assets/`)
Portfolio tracking with manual price snapshots. Data: `lifeLog/assets/`. See `assets/CLAUDE.md`.

## Data Model (Moment)

```json
{
  "YYYY-MM-DD": [
    { "id": "unique_id", "time": "HH:MM", "text": "description", "tags": ["M","A","I","F","H"] }
  ]
}
```

Tag semantics: **M** = Moment, **A** = Action, **I** = Insight, **F** = Feeling, **H** = Habit.

## Development Conventions

- All scripts use `<script type="module">` — ES module imports only
- Inline `onclick` handlers require `Object.assign(window, { fn1, fn2, ... })` to expose module-scoped functions
- No external libraries or CDN dependencies
- Each module has its own CLAUDE.md — open a separate Claude Code session per module to avoid context bloat

## Demo Data (MockDrive)

`MockDrive/lifeLog/` contains static JSON files committed to the repo. These are served by Cloudflare Pages as demo data for unauthenticated users, and by `npx serve .` for local dev.

To add or update demo data for a module, edit the corresponding file under `MockDrive/lifeLog/{module}/`. The structure must mirror the Google Drive folder layout exactly.
