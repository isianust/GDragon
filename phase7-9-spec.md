# Phase 7–9：大戰略・環境與AI引擎規格書

> **Project Dragon 龍騰** — 三國大戰略遊戲  
> **版本：** 1.0.0-draft  
> **日期：** 2025-07  
> **負責模組：** FogOfWarEngine, EnvironmentEngine, AIEngine  
> **相關原始碼：** `src/FogOfWarEngine.ts`, `src/EnvironmentEngine.ts`, `src/AIEngine.ts`, `src/types.ts`  
> **前置依賴：** [Phase 1–4 核心引擎](phase1-4-spec.md)、[Phase 5–6 視圖層](phase5-6-spec.md)

---

## 目錄

1. [資料模型擴充](#1-資料模型擴充)  
2. [戰爭迷霧與情報引擎](#2-戰爭迷霧與情報引擎)  
3. [動態環境與天氣引擎](#3-動態環境與天氣引擎)  
4. [進階移動引擎](#4-進階移動引擎)  
5. [動態 AI 引擎](#5-動態-ai-引擎)  

---

## 1. 資料模型擴充

> 於 Phase 1–6 既有 Interface 上新增屬性，完整型別定義見 `src/types.ts`。

### 1.1 Faction（勢力）

```typescript
export interface Faction {
  id: string;
  name: string;
  rulerId: string;
  capitalNodeId: string;
  aiArchetype: "AGGRESSIVE" | "DEFENSIVE" | "CAUTIOUS" | "OPPORTUNIST";
  globalPrestige: number;  // 0–100
}
```

### 1.2 Officer 擴充

```typescript
export interface Officer {
  // ... 既有屬性
  loyalty: number;    // 0–100
  isDead?: boolean;
}
```

### 1.3 MapNode 擴充

```typescript
export interface MapNode {
  // ... 既有屬性
  visibility?: "FULL" | "ESTIMATE" | "BLIND";  // 相對於玩家計算
}
```

### 1.4 Route 擴充

```typescript
export interface Route {
  // ... 既有屬性
  currentWeather: "CLEAR" | "RAIN" | "SNOW" | "FOG";
  weatherDuration: number;  // 剩餘持續 Tick 數
}
```

### 1.5 EnvironmentState（全域環境）

```typescript
export interface EnvironmentState {
  currentSeason: "SPRING" | "SUMMER" | "AUTUMN" | "WINTER";
}
```

---

## 2. 戰爭迷霧與情報引擎

> Phase 7 核心功能。相關原始碼：`src/FogOfWarEngine.ts`。

### 2.1 可見度狀態

| 狀態 | 條件 | 顯示內容 |
|------|------|----------|
| **FULL** | 節點屬於玩家、相鄰玩家節點、或有玩家間諜活動 | 精確兵力 / 資源數據 |
| **ESTIMATE** | 距離玩家視野 1–2 個節點 | 模糊範圍（如 `"2000–5000"`）；武將名稱顯示為 `"???"` |
| **BLIND** | 深入敵方腹地 | 僅顯示 `ownerId`（勢力顏色） |

### 2.2 偵察指令 (Reconnaissance Command)

- 指派 `IDLE` 狀態武將偵察目標節點

| 情境 | 結果 |
|------|------|
| 間諜 `intel` ≫ 太守 `intel` | 揭露精確數據，持續 30 Ticks |
| 間諜 `intel` ≪ 太守 `intel` | 敵方餵送假情報（顯示完全錯誤的兵力數據） |

---

## 3. 動態環境與天氣引擎

> Phase 7–8 功能。相關原始碼：`src/EnvironmentEngine.ts`。獨立引擎，於主 Tick 迴圈中調用。

### 3.1 季節循環 (Global)

| 季節 | Tick 範圍 | 全域效果 |
|------|-----------|----------|
| **SPRING（春）** | 0–90 | 士氣恢復 +10% |
| **SUMMER（夏）** | 91–180 | 糧食消耗率 +20%；`WATER` 路線速度提升 |
| **AUTUMN（秋）** | 181–270 | 收穫季：城市糧食產出 ×1.5 |
| **WINTER（冬）** | 271–360 | 行軍體力消耗 ×2；`MOUNTAIN` 路線速度 −50%；若 `carriedFood < 20%` 則軍隊凍結（士氣急速下降） |

### 3.2 區域天氣 (Local Routes)

> 每 10 Ticks 隨機選取 10–20% 路線，依當前季節賦予天氣狀態，持續 5–15 Ticks。

| 天氣 | 適用季節 | 效果 |
|------|----------|------|
| **CLEAR** | 全季 | 正常 |
| **RAIN** | 春 / 夏 | `PLAIN` 速度 −40%（泥濘）；`WATER` 速度 +20%；弓兵傷害 −50% |
| **SNOW** | 僅冬季 | `MOUNTAIN` 速度 −70%；後勤體力消耗 ×2 |
| **FOG** | 全季 | 速度 −20%；觸發「奇襲」：若攻方 `intel > 防方 intel`，首 Tick 戰鬥傷害 300% |

---

## 4. 進階移動引擎

> Phase 8 — 規模懲罰 (Scale Penalty)。更新 `MovementEngine` 速度計算。

### 4.1 規模乘數 (Scale Multiplier)

| 總兵力範圍 | 乘數 |
|------------|------|
| ≤ 1,000 | ×1.5 |
| 1,001 – 5,000 | ×1.0 |
| 5,001 – 15,000 | ×0.7 |
| > 15,000 | ×0.5 |

### 4.2 最終速度公式

```
finalSpeed = baseTerrainSpeed × weatherModifier × scaleModifier × staminaModifier
```

| 修正因子 | 計算方式 |
|----------|----------|
| `baseTerrainSpeed` | 參見 Phase 1–4 §3.2.1 兵種地形速度表 |
| `weatherModifier` | 參見本文 §3.2 區域天氣表 |
| `scaleModifier` | 參見本文 §4.1 規模乘數表 |
| `staminaModifier` | `stamina < 20` → `0.5`；否則 `1.0` |

---

## 5. 動態 AI 引擎

> Phase 9 功能。相關原始碼：`src/AIEngine.ts`。  
> **核心原則：** AI **禁止作弊**——必須遵守戰爭迷霧與後勤規則。

### 5.1 決策週期

| 層級 | 頻率 | 說明 |
|------|------|------|
| **Macro（宏觀）** | 每 30 Ticks（月） | 勢力層級戰略決策 |
| **Tactical（戰術）** | 每 Tick | 戰場即時微操 |

### 5.2 勢力原型 (Faction Archetypes)

| 原型 | 宏觀行為 |
|------|----------|
| **AGGRESSIVE** | 持續徵兵並派軍攻擊最弱的相鄰玩家節點 |
| **DEFENSIVE** | 專注 `POLICY_FOCUS_DRAFT`；僅在相鄰敵方節點兵力 < 己方邊境城市 20% 時才進攻 |
| **CAUTIOUS** | 拒絕進入 `BLIND` 節點；先派出輕騎先鋒（500 騎兵）偵察、觸發戰鬥、即撤退，再派主力 |
| **OPPORTUNIST** | 監控戰場；在附近戰鬥結束後立即趁虛而入 |

### 5.3 威脅評估與防禦協議

| 優先級 | 節點類型 | 防禦策略 |
|--------|----------|----------|
| **最高** | 首都節點 (CapitalNode) | 若受威脅（敵軍距 1 路線），觸發 `DEFEND_CORE`：取消所有擴張、召回軍隊 |
| **高** | 關卡 (GATE) | 部署高武力武將重兵駐守 |
| **中** | 前線城市 (Frontline CITY) | 標準防禦 |
| **低** | 後方城市 (Rear CITY) | 將兵力 / 糧食轉移至前線 |

### 5.4 戰術微操 (Tactical Field AI)

| 情境 | 行為 |
|------|------|
| **追擊** | 低智力 / 高武力主將：**必定追擊**撤退之敵。高智力主將：僅在 `stamina > 50` 且糧食充足時追擊 |
| **緊急撤退** | 戰鬥 / 攻城中若 AI 兵力 < 30% 且敵方 > 60%：高智力主將自動撤退以避免被俘；低智力主將死戰不退 |

---

> **交叉參照：** 核心公式請參閱 [Phase 1–4 規格書](phase1-4-spec.md)。  
> **下一階段：** Phase 10–12 將加入沙盒機制、地緣政治與災厄引擎，請參閱 [Phase 10–12 規格書](phase10-12-spec.md)。