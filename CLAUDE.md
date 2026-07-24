# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Life Management (lifeMgmt)** — a personal life tracking web app with three modules: Life Log, Fitness, and Assets. Deployed via Cloudflare. No build step, no framework, no server required — plain HTML/CSS/JavaScript.

## Repository Structure

```
action_rd/
├── lifeMgmt/               ← all active code lives here
│   ├── index.html          ← home/hub page (links to all modules)
│   ├── shared/
│   │   ├── style.css       ← design tokens + shared components
│   │   ├── nav.js          ← renderNav(activePage) — site-wide nav bar
│   │   ├── auth.js         ← Google OAuth helpers
│   │   └── drive.js        ← createDriveStore(folderName, onAuthFailure)
│   ├── lifeLog/
│   │   ├── index.html      ← Life Log module (active)
│   │   └── CLAUDE.md       ← module-level context for Life Log sessions
│   ├── fitness/
│   │   ├── index.html      ← Fitness module (placeholder)
│   │   └── CLAUDE.md       ← module-level context for Fitness sessions
│   └── assets/
│       ├── index.html      ← Assets module (placeholder)
│       └── CLAUDE.md       ← module-level context for Assets sessions
└── data/
    └── 2026.json           ← offline test data (from original local-file version)
```

## Running the App

Open any `index.html` directly in Chrome/Edge (deployed on Cloudflare — no local server needed for production). Auth uses Google OAuth 2.0; data is stored in Google Drive.

No lint, build, or test commands.

## Shared Infrastructure

All modules import from `lifeMgmt/shared/`:

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
renderNav('lifeLog'); // or 'fitness' | 'assets' | ''
```
Prepends the site-wide nav bar (`<div class="site-nav">`) to `<body>`.

### `auth.js`
```js
import { initAuth, signIn, signOut, getAccessToken, ensureToken } from '../shared/auth.js';
await initAuth({ onSignedIn, onSignOut });
```
Handles Google OAuth token lifecycle, localStorage caching, and silent refresh.

### `drive.js`
```js
import { createDriveStore } from '../shared/drive.js';
const store = createDriveStore('folderName', onAuthFailure);
// store.readJson(filename)  → parsed object, {} if not found
// store.writeJson(filename, data, onError)
// store.clearCache()
```
Each module creates its own store instance scoped to its own Drive folder.

## Modules

### Life Log (`lifeLog/`)
Records daily events tagged M/A/I/F/H. Data stored as `{year}.json` per year in Drive folder `lifeLog/`. See `lifeLog/CLAUDE.md` for full detail.

### Fitness (`fitness/`)
Exercise tracking, training load (ACWR), competition planning. Data in Drive folder `fitness/`. Currently a placeholder. See `fitness/CLAUDE.md`.

### Assets (`assets/`)
Portfolio tracking with manual price snapshots. Two files: `holdings.json` + `transactions_{year}.json` in Drive folder `assets/`. Currently a placeholder. See `assets/CLAUDE.md`.

## Data Model (Life Log)

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

## Test Data

`data/2026.json` contains real entries from the original local-file version of the app. Same JSON schema as the current Life Log data model. Use for offline testing.
