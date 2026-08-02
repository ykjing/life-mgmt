# Moment Module — CLAUDE.md

## 位置
`moment/index.html` — 單一 HTML 頁面，shared 模組在 `../shared/`。

## 模組目標
記錄每日事件並打標籤，支援年曆、列表（日/週/月/年）兩種視圖，以及 AI 分析匯出。

## Shared 基礎設施

```js
import { initAuth, signIn as authSignIn, signOut as authSignOut, getAccessToken } from '../shared/auth.js';
import { createDriveStore } from '../shared/drive.js';
import { renderNav } from '../shared/nav.js';
```

- `style.css` — design tokens、`.btn`、`.btn.primary`、`.toast`、`.auth-overlay`、`.site-nav`
- `drive.js` — `createDriveStore(folderPath, onAuthFailure)` → `{ readJson, writeJson, clearCache }`
- `nav.js` — `renderNav('moment')` 插入全站導覽列

## Store 設定

```js
const FOLDER_NAME = 'lifeLog/moment';
const store = createDriveStore(FOLDER_NAME, showAuthOverlay);

async function readYear(year)        { return store.readJson(`${year}.json`); }
async function writeYear(year, data) { return store.writeJson(`${year}.json`, data, () => showToast('Save failed', '')); }
```

資料儲存在 Google Drive `lifeLog/moment/{year}.json`。

## 資料模型

```json
{
  "YYYY-MM-DD": [
    {
      "id": "mq0mvkj155j",
      "time": "09:30",
      "text": "描述文字",
      "tags": ["M", "A"]
    }
  ]
}
```

- **Key**: `YYYY-MM-DD` 字串，O(1) 查詢
- **id**: `Date.now().toString(36) + random suffix`（`genId()`）
- **time**: `HH:MM` 或 `null`
- **tags**: 陣列，可複選，空陣列合法

### Tag 語意
| Tag | 名稱 | 說明 |
|-----|------|------|
| M | Moment | 美好/難忘的時刻 |
| A | Action | 完成的事、行動 |
| I | Insight | 深刻感悟、學習 |
| F | Feeling | 情緒、自我覺察 |
| H | Habit | 習慣追蹤 |

## State

```js
let currentYear  = new Date().getFullYear();
let currentView  = 'cal';          // 'cal' | 'list'
let currentDim   = 'day';          // 'day' | 'week' | 'month' | 'year'
const today      = new Date();
let cursor       = { year, month, day, week };
let panelDate    = null;           // { year, month, day } 當前開啟的 panel
let editingId    = null;           // 正在編輯的 entry id，null = 新增
let activeFilters = new Set();     // 'M'|'A'|'I'|'F'|'H'
```

## Views & 渲染函式

| 視圖 | 函式 |
|------|------|
| 年曆（年格） | `renderCalendar(year)` |
| 列表 dispatch | `renderList()` → 呼叫下方子函式 |
| 日視圖 | `renderDayList(el)` |
| 週視圖 | `renderWeekList(el)` |
| 月視圖 | `renderMonthList(el)` |
| 年視圖 | `renderYearList(el)` |
| Panel entries | `renderPanelEntries()` |
| 統計列 | `updateStats(year, data)` |

## 主要函式

```js
// 導航
switchView('cal' | 'list')
switchDim('day' | 'week' | 'month' | 'year')
movePeriod(±1)          // 依 currentDim 移動 cursor
goToday()
changeYear(±1)

// Panel（Day Modal）
openPanel(year, month, day)
closePanel()
renderPanelEntries()
renderAddTrigger()
renderEntryForm(entry | null)   // null = 新增
startEdit(entry)
saveFormEntry()
deleteEntry(id)

// Helpers
getDayKey(y, m, d)     // → 'YYYY-MM-DD'
todayKey()             // → getDayKey(today...)
getWeekNum(date)       // ISO week number (UTC-based)
getWeekDates(year, week) // → [Mon, Tue, ..., Sun] (7 Date objects)
genId()
```

## 週次計算（非直覺）
- `getWeekNum` 使用 UTC 計算 ISO 週數（避免 DST 問題）
- `getWeekDates` 使用 local Date 展開 7 天，從週一開始

## Auth 模式

Moment 使用**舊版 auth 模式**（非 three-mode init），沒有 demo mode：
- 頁面載入 → `initAuth({ onSignedIn, onSignOut: showAuthOverlay })`
- 登入成功 → `onSignedIn()` → 隱藏 overlay → `renderCalendar(currentYear)`
- Token 失效 → `showAuthOverlay()` 顯示登入提示
- Auth overlay 預設 `class="auth-overlay show"`（顯示），登入後移除 `show`

## Export 功能
- **Export JSON** — 下載當年資料為 `life-log-{year}.json`
- **AI Analysis** — 把當年資料包成 prompt 複製到剪貼簿，格式含 tag 說明

## Globals（inline onclick 用）

```js
Object.assign(window, {
  switchView, changeYear, signOut,
  toggleFilter, clearFilters,
  exportData, copyAIPrompt,
  switchDim, movePeriod, goToday,
  closePanel
});
```

## Keyboard shortcuts
- `Escape` — 關閉 panel
- `Ctrl/Cmd + Enter` — 儲存 entry form
- `←` / `→` — movePeriod（panel 未開啟時）

## 待改進項目（Future）
- 尚未採用 three-mode init（無 demo mode）
- `FOLDER_NAME` 目前寫死，若需要可改為 config 讀取
- 可考慮加入 MockDrive demo 支援（參考 fitness 模組）
