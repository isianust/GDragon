# Phase 13–15：外交・多人與終局規格書

> **Project Dragon 龍騰** — 三國大戰略遊戲  
> **版本：** 1.0.0-draft  
> **日期：** 2026-03  
> **負責模組：** DiplomacyEngine, MultiplayerService, EndgameEngine  
> **相關原始碼：** 待建立（`src/DiplomacyEngine.ts`, `src/MultiplayerService.ts`, `src/EndgameEngine.ts`）  
> **前置依賴：** [Phase 1–4](phase1-4-spec.md)、[Phase 5–6](phase5-6-spec.md)、[Phase 7–9](phase7-9-spec.md)、[Phase 10–12](phase10-12-spec.md)

---

## 目錄

1. [Phase 13：外交系統](#1-phase-13外交系統)  
2. [Phase 14：多人與網路架構](#2-phase-14多人與網路架構)  
3. [Phase 15：終局與戰役系統](#3-phase-15終局與戰役系統)  
4. [實作優先度矩陣](#4-實作優先度矩陣)  

---

## 1. Phase 13：外交系統

### 1.1 資料模型擴充

```typescript
export type DiplomaticRelation =
  | "NEUTRAL"
  | "TRADE_AGREEMENT"
  | "NON_AGGRESSION"
  | "MARRIAGE_ALLIANCE"
  | "VASSAL"
  | "SUZERAIN"
  | "WAR";

export type SpyMissionType =
  | "INTEL_GATHER"
  | "SABOTAGE"
  | "INCITE_REVOLT"
  | "ASSASSINATE"
  | "COUNTER_ESPIONAGE";

export interface DiplomaticPact {
  id: string;
  factionA: string;           // Faction ID
  factionB: string;           // Faction ID
  relation: DiplomaticRelation;
  startTick: number;
  durationTicks: number;      // 0 = 永久（直到毀約）
  tradeGoldPerMonth: number;  // 每月金幣交換量（可為負數表示朝貢）
  tradeFoodPerMonth: number;  // 每月糧食交換量
  cooldownTicks: number;      // 毀約後冷卻期
}

export interface SpyMission {
  id: string;
  officerId: string;          // 執行間諜任務的武將 ID
  targetFactionId: string;
  targetNodeId: string;
  missionType: SpyMissionType;
  progressTicks: number;      // 已執行 Tick 數
  requiredTicks: number;      // 任務所需總 Tick 數
  successChance: number;      // 0.0–1.0，基於 intel 計算
}

export interface DiplomaticReputation {
  factionId: string;
  honor: number;              // 0–100，毀約會降低
  intimidation: number;       // 0–100，戰勝會提高
  trustByFaction: Record<string, number>;  // 各勢力對此勢力的信任值
}
```

### 1.2 外交行動一覽

| 行動 | 條件 | 效果 | 冷卻 |
|------|------|------|------|
| **貿易協定 (Trade Agreement)** | 雙方非戰爭狀態；`honor ≥ 30` | 每月自動交換指定量金幣 / 糧食 | 毀約後 60 Ticks |
| **互不侵犯 (Non-Aggression Pact)** | 雙方非戰爭狀態 | 禁止宣戰 180 Ticks；違約者 `honor -= 30` | 毀約後 90 Ticks |
| **聯姻 (Marriage Alliance)** | 雙方各有至少一名 `IDLE` 武將 | 結合兩勢力武將 `bondIds`；共享邊境可見度 (`FULL`) | 解除後 120 Ticks |
| **朝貢 (Tribute)** | 國力差距 > 2 倍 | 弱方每月繳納金幣 / 糧食；強方不得攻擊弱方 | — |
| **宣戰 (Declare War)** | 無互不侵犯條約生效中 | 進入 `WAR` 狀態；可自由攻擊 | — |

### 1.3 間諜網路 (Spy Network)

#### 1.3.1 任務類型

| 任務 | 所需 Ticks | 基礎成功率 | 效果 |
|------|-----------|-----------|------|
| **情報蒐集 (INTEL_GATHER)** | 30 | `spy.intel / (spy.intel + mayor.intel)` | 目標節點可見度提升為 `FULL`，持續 60 Ticks |
| **破壞 (SABOTAGE)** | 60 | `spy.intel / 150` | 目標城市防禦 −30%；糧倉 −20% |
| **煽動叛亂 (INCITE_REVOLT)** | 90 | `spy.politics / 120` | 目標城市 `publicOrder -= 40`；若已 < 30 則觸發暴動 |
| **暗殺 (ASSASSINATE)** | 120 | `spy.martial / 200` | 目標太守或武將 `isDead = true`；失敗則間諜被俘 |
| **反間 (COUNTER_ESPIONAGE)** | 持續 | 被動觸發 | 每 Tick 檢測己方節點是否有敵方間諜；若 `counter.intel > spy.intel` 則俘獲間諜 |

#### 1.3.2 失敗後果

- 間諜被俘：`status = "CAPTURED"`，轉移至目標勢力
- 外交衝擊：被發現的勢力 `honor -= 15`；目標勢力 `trustByFaction[spyOwner] -= 25`

### 1.4 外交聲望系統

| 指標 | 增減條件 | 範圍 |
|------|----------|------|
| **Honor（信義）** | 履約 +5/月；毀約 −30；被發現間諜 −15 | 0–100 |
| **Intimidation（威望）** | 戰勝 +10；佔領城市 +5；戰敗 −10 | 0–100 |
| **Trust（信任）** | 各勢力獨立計算；持續和平 +2/月；遭攻擊 −50 | 0–100 |

> **AI 整合：** AI 引擎（Phase 9）的四種原型根據 `honor`、`intimidation`、`trust` 調整外交決策。例如 `CAUTIOUS` 原型在 `trust < 40` 時拒絕所有條約。

---

## 2. Phase 14：多人與網路架構

### 2.1 資料模型擴充

```typescript
export type ConnectionState =
  | "CONNECTING"
  | "LOBBY"
  | "IN_GAME"
  | "SPECTATING"
  | "DISCONNECTED";

export interface PlayerSession {
  playerId: string;
  displayName: string;
  factionId: string | null;
  connectionState: ConnectionState;
  latencyMs: number;
  lastHeartbeatTick: number;
}

export interface LobbyState {
  lobbyId: string;
  hostPlayerId: string;
  players: PlayerSession[];
  maxPlayers: number;           // 建議上限 8
  scenarioId: string;
  settings: MultiplayerSettings;
  isLocked: boolean;
}

export interface MultiplayerSettings {
  tickRateMs: number;           // 預設 5000，多人模式可調為 3000
  allowSpectators: boolean;
  pauseRequiresConsensus: boolean;
  maxTimeScaleMultiplier: number;  // 多人模式建議限制為 2x
  autoSaveIntervalTicks: number;
}

export interface SyncPayload {
  tick: number;
  commands: PlayerCommand[];     // 該 Tick 收集到的所有玩家指令
  checksum: string;              // GameState 校驗碼（反作弊用）
}

export interface PlayerCommand {
  playerId: string;
  tick: number;                  // 指令發出時的 Tick
  type: string;                  // 指令類型（如 "DISPATCH_ARMY", "SET_POLICY" 等）
  payload: Record<string, unknown>;
}
```

### 2.2 網路架構

```
┌──────────┐    WebSocket     ┌──────────────┐
│ Client A ├──────────────────┤              │
└──────────┘                  │              │
                              │  Relay Server │
┌──────────┐    WebSocket     │  (Authority)  │
│ Client B ├──────────────────┤              │
└──────────┘                  │              │
                              └──────┬───────┘
┌──────────┐    WebSocket            │
│ Spectator├─────────────────────────┘
└──────────┘
```

### 2.3 同步模型

| 項目 | 規格 |
|------|------|
| **協定** | WebSocket（主要）；WebRTC DataChannel（P2P fallback） |
| **同步策略** | Lock-Step Deterministic：所有客戶端在同一 Tick 執行相同指令集 |
| **指令收集** | 每 Tick 收集所有玩家指令 → 伺服器排序 → 廣播 `SyncPayload` |
| **延遲補償** | 若玩家延遲 > 2 Ticks，伺服器等待至超時（`tickRateMs × 2`）後強制推進 |
| **斷線處理** | 斷線玩家由 AI 接管（使用該勢力的 `aiArchetype`）；重連後恢復控制權 |

### 2.4 大廳系統 (Lobby)

| 功能 | 說明 |
|------|------|
| **建立房間** | Host 選擇劇本、設定參數、開放或加密房間 |
| **加入房間** | 透過房間 ID 或大廳列表加入 |
| **勢力選擇** | 每位玩家選擇一個勢力；未選擇的勢力由 AI 控制 |
| **準備 / 開始** | 全員確認後 Host 啟動遊戲 |
| **觀戰模式** | Spectator 以唯讀方式觀看完整 `GameState`（無迷霧） |

### 2.5 反作弊機制

| 機制 | 說明 |
|------|------|
| **Checksum 驗證** | 每 Tick 各客戶端計算 `GameState` 校驗碼並回報伺服器；不一致者觸發 Desync 警告 |
| **Server Authority** | 伺服器為最終裁決者；客戶端僅發送指令，不直接修改 `GameState` |
| **指令驗證** | 伺服器驗證每條指令的合法性（如：是否為該玩家的勢力、資源是否足夠） |
| **速率限制** | 每 Tick 每位玩家最多 10 條指令，防止 DoS |

---

## 3. Phase 15：終局與戰役系統

### 3.1 資料模型擴充

```typescript
export type VictoryType =
  | "UNIFICATION"
  | "PRESTIGE"
  | "EMPEROR_LEGITIMACY"
  | "CUSTOM";

export interface VictoryCondition {
  type: VictoryType;
  factionId: string;
  achievedAtTick: number | null;
  progress: number;             // 0.0–1.0
  description: string;
}

export interface CampaignScenario {
  id: string;
  name: string;
  description: string;
  startYear: number;            // 如 184（黃巾之亂）、190（諸侯討董）、200（官渡之戰）
  initialState: string;         // 劇本 JSON 路徑
  victoryConditions: VictoryCondition[];
  specialRules: string[];       // 特殊規則 ID 陣列
  isHistorical: boolean;
}

export interface ModManifest {
  modId: string;
  name: string;
  version: string;
  author: string;
  description: string;
  entryPoint: string;           // Mod 進入點 JS/TS 檔案路徑
  overrides: {
    officers?: string;          // 自訂武將 JSON 路徑
    nodes?: string;             // 自訂地圖 JSON 路徑
    routes?: string;            // 自訂路線 JSON 路徑
    factions?: string;          // 自訂勢力 JSON 路徑
  };
  hooks: string[];              // 可掛載的引擎事件（如 "onTickEnd", "onCombatResolve"）
}
```

### 3.2 勝利條件

| 勝利類型 | 條件 | 進度計算 |
|----------|------|----------|
| **統一天下 (UNIFICATION)** | 控制所有地圖節點 | `ownedNodes / totalNodes` |
| **聲望制霸 (PRESTIGE)** | `globalPrestige ≥ 95` 且持續 4 個季度（360 Ticks） | `sustainedTicks / 360` |
| **天子正統 (EMPEROR_LEGITIMACY)** | 控制天子節點（`hasEmperor`）且 `globalPrestige ≥ 80` 且無反叛聯盟存在 | 複合條件檢查 |
| **自訂 (CUSTOM)** | 由劇本或 Mod 定義 | 自訂函式 |

### 3.3 戰役模式 (Campaign Mode)

#### 3.3.1 歷史劇本

| 劇本 ID | 名稱 | 起始年份 | 特殊規則 |
|---------|------|----------|----------|
| `SCENARIO_YELLOW_TURBAN` | 黃巾之亂 | 184 | 黃巾軍為 `HORDE` 勢力；大量 `BANDIT` 隨機生成 |
| `SCENARIO_COALITION` | 諸侯討董 | 190 | 反董聯盟自動成立；呂布特殊 AI |
| `SCENARIO_THREE_KINGDOMS` | 三分天下 | 220 | 魏蜀吳三勢力鼎立；外交系統強化 |
| `SCENARIO_NORTHERN_EXPEDITION` | 北伐中原 | 228 | 蜀漢限時攻克長安；糧食消耗 ×1.5 |

#### 3.3.2 系統互動圖

```
┌─────────────┐     載入劇本      ┌──────────────┐
│  Campaign    ├─────────────────▶│   Loader     │
│  Selector    │                  │  (JSON Parse)│
└─────────────┘                  └──────┬───────┘
                                        │
                                        ▼
                               ┌──────────────┐
                               │  GameState   │
                               │  Initialize  │
                               └──────┬───────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                  ▼
             ┌────────────┐  ┌──────────────┐  ┌──────────────┐
             │ TickEngine │  │ DiplomacyEng │  │ EndgameEng   │
             │ (Phase 1-4)│  │ (Phase 13)   │  │ (Phase 15)   │
             └────────────┘  └──────────────┘  └──────┬───────┘
                                                      │
                                                      ▼
                                              ┌──────────────┐
                                              │  Victory     │
                                              │  Check       │
                                              └──────────────┘
```

### 3.4 Modding API

#### 3.4.1 架構概述

| 項目 | 規格 |
|------|------|
| **Mod 格式** | `ModManifest` JSON + JavaScript/TypeScript 模組 |
| **載入時機** | 遊戲啟動時掃描 `mods/` 目錄，依 `ModManifest` 載入 |
| **資料覆寫** | 支援覆寫武將、節點、路線、勢力的 JSON 資料 |
| **事件掛鉤 (Hooks)** | 提供引擎事件回調：`onTickStart`、`onTickEnd`、`onCombatResolve`、`onSiegeResolve`、`onEconomyResolve` |
| **沙盒限制** | Mod 程式碼運行於受限環境；禁止直接存取 DOM 或網路 |

#### 3.4.2 Hook 範例

```typescript
// mods/my-mod/index.ts
import type { GameState } from "../../src/types";

export function onTickEnd(state: GameState): void {
  // 自訂邏輯：每年冬季降低所有城市治安
  if (state.environment.currentSeason === "WINTER") {
    for (const node of Object.values(state.nodes)) {
      if (node.type === "CITY") {
        node.publicOrder = Math.max(0, node.publicOrder - 1);
      }
    }
  }
}
```

### 3.5 桌面封裝 (Desktop Packaging)

| 項目 | 規格 |
|------|------|
| **框架** | Electron（首選）或 Tauri（輕量替代方案） |
| **建構工具** | Vite + `electron-builder` / `tauri-cli` |
| **平台支援** | Windows (x64)、macOS (ARM64/x64)、Linux (x64) |
| **Steam 整合** | 透過 `steamworks.js` 支援成就、雲端存檔、工作坊（Mod 分享） |
| **離線模式** | 完整支援；多人模式需網路連線 |

---

## 4. 實作優先度矩陣

| 優先級 | 模組 | Phase | 估計工時 | 依賴項 |
|--------|------|-------|----------|--------|
| **P0（必要）** | 外交條約系統 | 13 | 2 週 | Phase 10 地緣政治 |
| **P0（必要）** | 間諜網路 | 13 | 2 週 | Phase 7 戰爭迷霧 |
| **P0（必要）** | 勝利條件檢查 | 15 | 1 週 | Phase 10–12 全部 |
| **P1（重要）** | WebSocket 同步 | 14 | 3 週 | Phase 1–4 Tick 引擎 |
| **P1（重要）** | 大廳系統 | 14 | 1 週 | WebSocket 同步 |
| **P1（重要）** | 歷史劇本 | 15 | 2 週 | 勝利條件檢查 |
| **P2（增強）** | 反作弊機制 | 14 | 2 週 | WebSocket 同步 |
| **P2（增強）** | 觀戰模式 | 14 | 1 週 | WebSocket 同步 |
| **P2（增強）** | Modding API | 15 | 3 週 | Phase 1–12 全部 |
| **P3（可選）** | WebRTC P2P | 14 | 2 週 | WebSocket 同步 |
| **P3（可選）** | Steam / Electron 封裝 | 15 | 2 週 | 所有遊戲功能 |
| **P3（可選）** | 外交聲望 AI 整合 | 13 | 1 週 | 外交條約 + Phase 9 AI |

---

> **交叉參照：**  
> - 核心引擎：[Phase 1–4 規格書](phase1-4-spec.md)  
> - 視圖層：[Phase 5–6 規格書](phase5-6-spec.md)  
> - AI 與環境：[Phase 7–9 規格書](phase7-9-spec.md)  
> - 沙盒與災厄：[Phase 10–12 規格書](phase10-12-spec.md)  
