# Assets Module — CLAUDE.md

## What this is
The **Assets** module is one page of the Life Management app. It tracks personal investment holdings, records price snapshots manually, and shows portfolio overview, P&L, and net worth trend.

## How to run
Open `lifeMgmt/assets/index.html` directly in Chrome/Edge (deployed via Cloudflare). No build step. The module uses the same Google Drive backend and shared auth as the other modules.

## Shared infrastructure (read these files)
All shared code lives in `../shared/`:
- `auth.js` — Google OAuth, `initAuth`, `signIn`, `signOut`, `getAccessToken`, `ensureToken`
- `drive.js` — `createDriveStore(folderName, onAuthFailure)` → `{ readJson, writeJson, clearCache }`
- `nav.js` — `renderNav('assets')` prepends the site-wide nav bar to `<body>`
- `style.css` — design tokens, `.btn`, `.btn.primary`, `.toast`, `.auth-overlay`, `.site-nav`

Design tokens (dark theme):
```
--bg, --surface, --surface2, --border, --text, --muted, --accent (#6c8ebf)
```

## Store setup (use exactly this pattern)
```js
import { initAuth, signIn as authSignIn, signOut as authSignOut, getAccessToken } from '../shared/auth.js';
import { createDriveStore } from '../shared/drive.js';
import { renderNav } from '../shared/nav.js';

const store = createDriveStore('assets', showAuthOverlay);

async function readHoldings()           { return await store.readJson('holdings.json')      ?? { assets: [], snapshots: [] }; }
async function writeHoldings(data)      { await store.writeJson('holdings.json', data, () => showToast('儲存失敗')); }
async function readTx(year)             { return await store.readJson(`transactions_${year}.json`) ?? []; }
async function writeTx(year, list)      { await store.writeJson(`transactions_${year}.json`, list, () => showToast('儲存失敗')); }
```

Note: `readJson` returns `{}` (not `null`) when the file doesn't exist — always apply `?? default` or check for missing keys.

## Data model

### `holdings.json`
```json
{
  "assets": [
    {
      "id": "abc123",
      "name": "台積電",
      "ticker": "2330.TW",
      "type": "stock",
      "currency": "TWD",
      "quantity": 1000,
      "costBasis": 580.0,
      "note": "",
      "deleted": false
    },
    {
      "id": "ghi789",
      "name": "活存-國泰",
      "ticker": null,
      "type": "cash",
      "currency": "TWD",
      "quantity": 1,
      "costBasis": 300000,
      "note": "台幣活存"
    }
  ],
  "snapshots": [
    {
      "date": "2026-06-09",
      "values": { "abc123": 650.0, "ghi789": 300000 },
      "fxRates": { "USD": 32.5 }
    }
  ]
}
```

### `transactions_{year}.json` (e.g. `transactions_2026.json`)
Array of transaction objects:
```json
[
  { "id": "tx001", "date": "2026-03-15", "assetId": "abc123", "action": "buy",
    "quantity": 200, "price": 570.0, "fee": 102, "currency": "TWD", "note": "" },
  { "id": "tx002", "date": "2026-06-01", "action": "dividend", "assetId": "abc123",
    "amount": 4500, "currency": "TWD", "note": "2025 年度股利" }
]
```

### Asset types
`stock` | `etf` | `cash` | `crypto` | `real_estate` | `other`

### Transaction actions
`buy` | `sell` | `dividend` | `deposit` | `withdraw` | `transfer`

### Key invariants
- **Cash assets**: `quantity` is always 1; `costBasis` = total balance amount
- **Soft delete**: never remove assets — set `deleted: true` so historical transactions stay valid
- **No real-time prices**: all prices are entered manually as point-in-time snapshots
- **Multi-currency**: TWD is the base currency; USD (and others) need `fxRates` per snapshot

## Core calculations

```js
function latestSnapshot(holdings) {
  return holdings.snapshots.at(-1) ?? { values: {}, fxRates: {} };
}

function assetValueTWD(asset, snapshot) {
  const price = snapshot.values[asset.id] ?? asset.costBasis;
  const value = asset.type === 'cash' ? price : price * asset.quantity;
  const rate = snapshot.fxRates[asset.currency] ?? 1;
  return value * (asset.currency === 'TWD' ? 1 : rate);
}

function unrealizedPnL(asset, latestPrice) {
  if (asset.type === 'cash') return { amount: 0, pct: 0 };
  const cost = asset.costBasis * asset.quantity;
  const current = latestPrice * asset.quantity;
  return { amount: current - cost, pct: (current - cost) / cost * 100 };
}

function portfolioTotal(assets, snapshot) {
  return assets
    .filter(a => !a.deleted)
    .reduce((s, a) => s + assetValueTWD(a, snapshot), 0);
}
```

## ID generation
```js
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2,5); }
```

## Planned views (implement in this order)

1. **總覽儀表板** — top-level metrics (total TWD, day/month change placeholder), pie chart by asset type using Canvas API (no external charting lib)
2. **持倉列表** — table/card list of non-deleted assets with latest price, value, P&L %, weight
3. **新增快照 modal** — date picker + input fields for each asset's current price + FX rates
4. **新增/編輯資產 modal** — name, ticker, type, currency, quantity, cost basis, note
5. **新增交易 modal** — action type, asset, date, qty/price/fee or amount (for dividends)
6. **淨值走勢** — line chart from snapshots array (Canvas), showing total TWD over time

## Auth overlay pattern (copy from lifeLog)
```html
<div class="auth-overlay show" id="authOverlay">
  <div class="auth-box">
    <h1>Assets</h1>
    <p class="auth-loading" id="authLoading">Signing in…</p>
    <p class="auth-desc" id="authDesc">Sign in with Google to access your assets.</p>
    <button class="google-btn" id="btnSignIn">…Google SVG…Sign in with Google</button>
    <p class="auth-note" id="authNote">Private to you · Stored in your Google Drive</p>
  </div>
</div>
```

```js
function showAuthOverlay() {
  document.getElementById('authLoading').style.display = 'none';
  document.getElementById('authDesc').style.display    = '';
  document.getElementById('btnSignIn').classList.add('visible');
  document.getElementById('authNote').classList.add('visible');
  document.getElementById('authOverlay').classList.add('show');
}
function hideAuthOverlay() { document.getElementById('authOverlay').classList.remove('show'); }

async function onSignedIn() {
  hideAuthOverlay();
  // load data and render
}

async function init() {
  renderNav('assets');
  document.getElementById('btnSignIn').addEventListener('click', () =>
    authSignIn(onSignedIn, () => showToast('Sign-in failed'))
  );
  await initAuth({ onSignedIn, onSignOut: showAuthOverlay });
}
document.addEventListener('DOMContentLoaded', init);
```

## Expose globals for inline onclick handlers
```js
Object.assign(window, {
  signOut, openAddAsset, openEditAsset, openAddSnapshot, openAddTx, closeModal
});
```

## Toast helper
```js
function showToast(msg) {
  document.getElementById('toastMsg').textContent = msg;
  const t = document.getElementById('toast');
  t.classList.add('open'); setTimeout(() => t.classList.remove('open'), 3000);
}
```

## Current file state
`index.html` is a placeholder — replace it entirely with the real implementation. Keep `<link rel="stylesheet" href="../shared/style.css">` and `<script type="module">`.

## Reference: lifeLog implementation
For patterns on modal structure, entry forms, and Drive read/write flow, read `../lifeLog/index.html`. The assets module follows the same conventions.
