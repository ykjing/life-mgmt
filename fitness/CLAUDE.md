# CLAUDE.md — Fitness Module

## 位置
`fitness/index.html` — 單一 HTML 頁面，shared 模組在 `../shared/`。

## 模組目標
1. **訓練日誌** — 記錄每次訓練（日期、類型、時長、強度、備註）
2. **訓練負荷** — 週/月累積 Load 趨勢，避免過訓或停滯
3. **備賽計畫** — 設定目標比賽日，往回規劃訓練週期
4. **AI 教練** — 依訓練數據分析進度、給予課表建議（Gemini API）

## 資料模型

資料存在 Google Drive 的 `lifeLog/fitness/` 資料夾，每年一個 JSON 檔（`2026.json`）。

```json
{
  "2026-06-09": [
    {
      "id": "abc123",
      "time": "07:30",
      "type": "easy",
      "duration": 50,
      "rpe": 6,
      "load": 300,
      "status": "done",
      "note": "輕鬆晨跑",
      "metrics": {
        "distance": 6.8,
        "avgPace": "7:21",
        "avgHR": 138,
        "avgCadence": 168,
        "avgStrideLength": 89,
        "avgGroundContactTime": 262,
        "avgVerticalOscillation": 7.4,
        "avgVerticalRatio": 10.2
      }
    }
  ],
  "_competitions": [...]
}
```

### 欄位說明
| 欄位 | 說明 |
|------|------|
| `type` | `easy` / `lsd` / `intervals` / `strength` / `cardio` / `rest` / `badminton` / … |
| `duration` | 分鐘 |
| `rpe` | 主觀費力度 1–10 |
| `load` | `duration × rpe`，用於累積負荷計算 |
| `status` | `done` / `skip` / `partial` |
| `_competitions` | 年度頂層鍵，底線前綴避免和日期鍵混淆 |

### `metrics` 欄位（跑步）
| 欄位 | 單位 | 來源 |
|------|------|------|
| `distance` | km | FIT / CSV / 手動 |
| `avgPace` | `M:SS` 字串 | 衍生 |
| `avgHR` | bpm | FIT / CSV / 手動 |
| `avgCadence` | spm | FIT / CSV / 手動 |
| `avgStrideLength` | cm | FIT（speed ÷ (spm/60)） |
| `avgGroundContactTime` | ms | FIT field 41（÷10） |
| `avgVerticalOscillation` | cm | FIT field 39（mm÷10） |
| `avgVerticalRatio` | % | FIT field 83（÷100） |
| `segmentType` | `'continuous'` / `'interval'` | FIT 主段切割後設定 |
| `splits` | 陣列 | continuous: `[{km, pace, avgHR, spm, strideM}]`；run_walk: `[{km, runPace, runAvgHR, runSpm, walkAvgHR, walkPct}]` |
| `reps` | 陣列 | interval: work/recovery 交叉 `[{kind:'work', rep, distM, pace, avgHR, peakHR, gctMs}, {kind:'recovery', durationS, startHR, endHR, dropHR}, ...]` |
| `repCount` | 整數 | interval work 趟數 |
| `workAvgPace` | `M:SS` 字串 | interval work 趟平均配速 |
| `workAvgHR` | bpm | interval work 趟平均心率 |

其他運動的 metrics 欄位（組數、重量等）為自由擴充。

### 備賽資料
`plan.json` 與 `goals.json` 分別儲存訓練課表與目標賽事，從 Drive 讀取（demo 模式從 MockDrive 讀）。

## 與 shared 模組的整合

Follow the three-mode init pattern in the top-level CLAUDE.md.

```js
// Drive stores
sharedStore = createDriveStore('lifeLog', onAuthFail);
store       = createDriveStore('lifeLog/fitness', onAuthFail);

// 讀取年度資料
const raw = await store.readJson(`${year}.json`);
data = raw ?? {};

// 讀取課表與目標
const rawPlan = await store.readJson('plan.json');
if (rawPlan) PLAN = rawPlan;
const rawGoals = await store.readJson('goals.json');
if (rawGoals?.length) GOALS = rawGoals;

// 讀取 Gemini key（shared）
const config = await sharedStore.readJson('config.json');
if (config?.geminiKey) geminiKey = config.geminiKey;
```

`renderNav('fitness')` 在 `init()` 最開始呼叫。

## 核心計算

### 週負荷（Weekly Load）
```js
function weekLoad(data, isoWeek) {
  return daysInWeek(isoWeek)
    .flatMap(d => data[d] ?? [])
    .reduce((s, e) => s + (e.load ?? 0), 0);
}
```

### Acute:Chronic Workload Ratio（ACWR）
- Acute = 過去 7 天 load 平均
- Chronic = 過去 28 天 load 平均
- ACWR = Acute / Chronic；0.8–1.3 是安全區間

## Garmin FIT 匯入

`parseGarminFIT(buffer)` — 純 JS，無依賴，直接讀 ArrayBuffer。

**讀取的訊息類型：**
- **Session（gid 18）**：sport、elapsed time、distance、avgHR、avgCadence
- **Lap（gid 19）**：start_time、elapsed、distance、avgHR、avgCadence — 供間歇分圈
- **Record（gid 20）**：逐點 HR、cadence、speed、running dynamics

**關鍵計算原則：**
- 距離 = ∫ speed·dt（對時間積分），不用 session distance 欄位
- 步幅 = speed ÷ (spm/60)，單位 cm（比 FIT step_length field 可靠）
- 步頻：FIT 存單腳 rpm，`(cadence + frac_cad/128) × 2` = spm
- 壓縮時間戳記 record（hdr & 0x80）正常解析，不跳過

**Running dynamics FIT field numbers（Record 訊息）：**
| Field # | 名稱 | Scale | 單位 |
|---------|------|-------|------|
| 39 | vertical_oscillation | ÷10 mm → ÷10 = cm | cm |
| 41 | ground_contact_time | ÷10 | ms |
| 83 | vertical_ratio | ÷100 | % |
| 73 / 6 | enhanced_speed / speed | ÷1000 | m/s |
| 53 | fractional_cadence | ÷128 | foot rpm |

### 主段切割（segmentation helpers）

`autoRunType(date, 'running')` → `'easy'` / `'lsd'` / `'intervals'`，由此決定切割方式：

| type | 做法 | 輸出 |
|------|------|------|
| `easy` / `lsd` | cadence 裁頭尾（`trimContinuous`）→ mainRecs | `splits` 每公里分段 |
| `intervals` | Lap boundary（`classifyLaps`）→ work 圈 records | `reps` + `workAvgPace/HR` |

**helpers：**
- `decodeRecs(rawRecs)` — 原始 field map → `{t, ts, dt, spd, spm, hr, vo, gct, vr}` 陣列，`t` = elapsed seconds
- `smoothSPM(recs)` — 10s centred rolling mean，與 recs 等長
- `trimContinuous(recs, smooth)` — 找頭尾第一/最後一個 spm≥140 且持續≥30s 的區間 → `[si, ei]`
- `classifyLaps(rawLaps, recs, firstRecTs)` — 解碼 Lap + 依 spm 分類 work/warmup/cooldown/recovery；移除 session-summary lap（elapsed ≥ 80% 總計）
- `buildRepData(labeledLaps)` — work/recovery 交叉輸出
- `buildKmSplits(recs)` — tagCumDist → 每 1000m 一個 bucket
- `buildRunWalkSplits(recs, smooth)` — run/walk 各自統計（保留備用，autoRunType 目前不回傳 run_walk）

**Tier 2（時序）：**
- `downsample(mainRecs, 5)` → `{interval_s:5, points:[{t, hr, spm, pace_s_km, gct_ms, vert_osc_cm, vert_ratio_pct}]}`
- 附在 return 物件的 `_tier2` 欄位（底線前綴 = 暫存，不寫進 2026.json）
- `confirmImport` 在寫 Drive 前先把 `_tier2` 存到 `timeseries/<date>_run_<time>.json`，再 `delete a._tier2`

**批次匯入：**
- `handleImportFiles(event)` — 支援多檔同時選取（.zip / .fit / .csv / .tcx）
- `extractActivitiesFromZip(buffer)` — 從 zip 解壓取出 .fit（優先）/ .tcx / .csv

## Session Array 工具函式

存檔格式保持 date-keyed `2026.json`；需要送 AI 時用以下函式即時轉換：

```js
// date-keyed data → 排序後的 session array（metrics 欄位提升到頂層）
buildSessionArray(data)

// 從 session array 取「最近 20 次」或「最近 3 個月」，取涵蓋較多的那個
recentSessions(sessions)

// 格式化單筆訓練為文字（只顯示有值的欄位）
fmtSession(s)  // → "6.8km，配速 7:21，HR 138bpm，GCT 262ms，…"
```

設計原則：source-of-truth 不動，只在 AI prompt 組裝時轉換，不寫回 Drive。

## AI 教練

Gemini key 存在 `lifeLog/config.json`（`sharedStore` 讀取，各模組共用）。

### 整體課表分析（`buildCoachingPrompt` → `runAICoach`）
- 輸入：目標賽事 + ACWR + 已完成週摘要 + 近12週 rollup（`buildRollup`）+ PBs + `recentSessions` 跑步數據 + 未來 3 週課表
- 模型：Gemini 2.0 Flash，maxOutputTokens: 1200
- 輸出：繁體中文，三段條列（訓練狀況評估 / 課表建議 / 賽前注意事項）

### 單次訓練分析（`runAISess`）
- 從儲存 panel 的「AI 分析」按鈕觸發
- 輸入：本次訓練完整 metrics（含 running dynamics）+ `recentSessions` 同類型比較 + 未來課表
- 使用 `fmtSession()` 統一格式化

## 資料架構

本模組遵循 workout-data-architecture skill 的三層設計：
- **Tier 1**：`2026.json`（date-keyed，永久保留，session summary + segmentation metrics）
- **Tier 2**：`timeseries/<date>_run_<time>.json`（5s 格點，`confirmImport` 寫入；不存進 2026.json）
- **Tier 3**：`buildRollup(data)` on-the-fly，不寫 Drive，供 AI prompt 使用

### `buildRollup(data)` 輸出結構
```js
{
  weekly: [{ week: '2026-W29', totalLoad, runKm, sessions, avgHR? }, ...], // 近12週
  monthly:[{ month: '2026-07', totalLoad, runKm, sessions }, ...],        // 近6個月
  pbs: { longestRun?, fastestPace5k?, fastestPace10k? }
}
```

## 視圖

| 視圖 | 說明 |
|------|------|
| 月曆視圖 | 每格顯示當日訓練類型色塊與 load |
| 週趨勢圖 | 過去 12 週 load 棒狀圖，標示 ACWR 安全區間 |
| 備賽計畫 | 週期表 + 倒數天數，從 `plan.json` 讀取 |
| AI 教練 modal | 整體課表分析，需 Gemini key |
| 單次 AI 分析 | 儲存後從 panel 觸發 |

## 注意事項
- `_competitions` 以底線開頭，與日期鍵（`YYYY-MM-DD`）區分，避免渲染時誤處理
- inline `onclick` handlers 需透過 `Object.assign(window, {...})` 暴露
- Week boundary 用 ISO week（週一為第一天）
- `saveData()` 需先判斷 `if (isDemoMode) return`，demo 模式不寫 Drive
