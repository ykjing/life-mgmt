# CLAUDE.md — Fitness Module

## 位置
`lifeMgmt/fitness/index.html` — 單一 HTML 頁面，shared 模組在 `../shared/`。

## 模組目標
1. **訓練日誌** — 記錄每次訓練（日期、類型、時長、強度、備註）
2. **訓練負荷** — 週/月累積 Load 趨勢，避免過訓或停滯
3. **備賽計畫** — 設定目標比賽日，往回規劃訓練週期

## 資料模型

資料存在 Google Drive 的 `fitness/` 資料夾，每年一個 JSON 檔（`2026.json`）。

```json
{
  "2026-06-09": [
    {
      "id": "abc123",
      "time": "07:30",
      "type": "strength",
      "duration": 75,
      "rpe": 7,
      "load": 525,
      "sport": "powerlifting",
      "note": "大重量日，蹲舉感覺良好",
      "metrics": {}
    }
  ],
  "_competitions": [
    {
      "id": "comp1",
      "date": "2026-09-20",
      "name": "全國健力錦標賽",
      "sport": "powerlifting",
      "goals": { "squat": 180, "bench": 110, "deadlift": 220 }
    }
  ]
}
```

### 欄位說明
| 欄位 | 說明 |
|------|------|
| `type` | `strength` / `cardio` / `sport` / `rest` |
| `duration` | 分鐘 |
| `rpe` | 主觀費力度 1–10（Rate of Perceived Exertion）|
| `load` | `duration × rpe`，用於累積負荷計算 |
| `sport` | 自由文字（powerlifting / running / basketball / …）|
| `metrics` | 彈性擴充，不同運動放不同數值（組數、重量、距離等）|
| `_competitions` | 年度頂層鍵，儲存該年度所有目標比賽 |

## 與 shared 模組的整合

```js
import { initAuth, signIn as authSignIn, signOut as authSignOut, getAccessToken } from '../shared/auth.js';
import { createDriveStore } from '../shared/drive.js';
import { renderNav } from '../shared/nav.js';

const store = createDriveStore('fitness', showAuthOverlay);

async function readYear(year) {
  const raw = await store.readJson(`${year}.json`);
  return raw ?? {};
}

async function writeYear(year, data) {
  await store.writeJson(`${year}.json`, data, () => showToast('儲存失敗'));
}
```

`renderNav('fitness')` 在 `init()` 最開始呼叫。

## 核心計算

### 週負荷（Weekly Load）
```js
function weekLoad(data, isoWeek) {
  // 把該週每日 entries 的 load 加總
  return daysInWeek(isoWeek)
    .flatMap(d => data[d] ?? [])
    .reduce((s, e) => s + (e.load ?? 0), 0);
}
```

### Acute:Chronic Workload Ratio（ACWR）
- Acute = 過去 7 天 load 平均
- Chronic = 過去 28 天 load 平均
- ACWR = Acute / Chronic；0.8–1.3 是安全區間

## 視圖規劃

| 視圖 | 說明 |
|------|------|
| 月曆視圖 | 每格顯示當日訓練類型色塊與 load 數值 |
| 週趨勢圖 | 棒狀圖顯示過去 12 週 load，標示安全/過訓區間 |
| 備賽倒數 | 距目標比賽天數 + 剩餘週期規劃 |
| 新增/編輯 modal | 和 lifeLog 相同 panel 設計風格 |

## 注意事項
- `_competitions` 以底線開頭，與日期鍵（`YYYY-MM-DD`）區分，避免渲染時誤處理
- inline `onclick` handlers 需透過 `Object.assign(window, {...})` 暴露（同 lifeLog 模式）
- Week boundary 用 ISO week（週一為第一天），與 lifeLog 一致
- 目前 `fitness/index.html` 是 placeholder，開始實作前先確認資料模型符合需求
