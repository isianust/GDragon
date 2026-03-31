# Phase 1–4：核心無頭引擎規格書

> **Project Dragon 龍騰** — 三國大戰略遊戲  
> **版本：** 1.0.0-draft  
> **日期：** 2026-03  
> **負責模組：** Headless Engine Core  
> **相關原始碼：** `src/types.ts`, `src/tickEngine.ts`, `src/engine/`

---

## 目錄

1. [核心架構](#1-核心架構)  
2. [核心資料模型](#2-核心資料模型)  
3. [邏輯引擎與公式](#3-邏輯引擎與公式)  
4. [Stage 1 劇本資料](#4-stage-1-劇本資料)  

---

## 1. 核心架構

### 1.1 架構概述

| 項目 | 規格 |
|------|------|
| **架構模式** | Real-Time with Pause，純客戶端無頭引擎（View Layer 於 Phase 5–6 加入） |
| **Tick 系統** | 連續迴圈，1 Tick = 1 遊戲內日 |
| **基礎速率** | 每 Tick 預設 5000 ms（實際壁鐘時間） |
| **時間倍率 (TimeScale)** | `1x` · `2x` · `4x` · `Pause` |

### 1.2 Tick 執行順序

每一 Tick 依序執行以下四個階段：

| 階段 | 名稱 | 處理內容 |
|------|------|----------|
| **Phase A** | 後勤與移動 (Logistics & Movement) | 更新行軍進度、扣除糧食與體力、檢查飢餓狀態 |
| **Phase B** | 碰撞偵測 (Collision) | 偵測 Node / Route 碰撞：軍隊 vs 敵軍 → `COMBAT`；軍隊 vs 敵城 → `SIEGE` |
| **Phase C** | 結算 (Resolution) | 執行一步戰鬥 / 攻城結算 |
| **Phase D** | 經濟 (Economy) | 當 `currentTick % 30 === 0` 時觸發城市產出 |

---

## 2. 核心資料模型

> 完整型別定義請參閱 `src/types.ts`。以下列出 Phase 1–4 所需的核心 Interface。

### 2.1 Officer（武將）

```typescript
export interface Officer {
  id: string;
  name: string;
  stats: {
    command: number;   // 統率
    martial: number;   // 武力
    intel: number;     // 智力
    politics: number;  // 政治
    luck: number;      // 運氣
  };
  trait: string;
  status: "IDLE" | "MARCHING" | "COMBAT" | "SIEGE" | "CAPTURED";
  locationId: string;  // Node ID 或 Route ID
  ownerId: string;     // Faction ID
}
```

### 2.2 MapNode（地圖節點）

```typescript
export interface MapNode {
  id: string;
  name: string;
  type: "CITY" | "GATE";
  ownerId: string;
  defense: number;
  maxDefense: number;
  resources: { gold: number; food: number; troops: number };
  mayorId: string | null;
  policy: "POLICY_FOCUS_GOLD" | "POLICY_FOCUS_FOOD" | "POLICY_FOCUS_DRAFT" | "POLICY_BALANCED";
}
```

### 2.3 Route（路線）

```typescript
export interface Route {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  type: "PLAIN" | "MOUNTAIN" | "WATER";
  distance: number;
  isHidden: boolean;
}
```

### 2.4 Army（軍隊）

```typescript
export interface Army {
  id: string;
  ownerId: string;
  commanderId: string;      // 主將 Officer ID
  deputyIds: string[];      // 副將（最多 2 名）
  carriedFood: number;      // 出征時從城市扣除
  troops: { cavalry: number; infantry: number; archer: number };
  morale: number;            // 0–100
  stamina: number;           // 0–100
  status: "IDLE" | "MARCHING" | "COMBAT" | "SIEGE";
  pathQueue: string[];       // Route ID 佇列（尋路結果）
  currentRouteId: string | null;
  progress: number;          // 當前路線已行進距離
  targetNodeId: string | null;
}
```

### 2.5 GameState（遊戲狀態）

```typescript
export interface GameState {
  currentTick: number;
  officers: Record<string, Officer>;
  nodes: Record<string, MapNode>;
  routes: Record<string, Route>;
  armies: Record<string, Army>;
}
```

---

## 3. 邏輯引擎與公式

### 3.1 編制與後勤引擎 (Formation & Logistics Engine)

| 項目 | 公式 / 規則 |
|------|-------------|
| **最大兵力** | `5000 × (1 + deputyIds.length)` |
| **總兵力 (TotalTroops)** | `cavalry + infantry + archer` |
| **每 Tick 糧食消耗** | `TotalTroops × 0.01`（從 `carriedFood` 扣除） |
| **飢餓效果** | 若 `carriedFood ≤ 0`：每 Tick `stamina -= 1.0`、`morale -= 2.0` |
| **軍隊解散** | 若 `morale ≤ 0`，軍隊即時解散（刪除） |
| **行軍體力消耗** | 正常行軍每 Tick `stamina -= 0.1` |

### 3.2 移動引擎 (Movement Engine)

#### 3.2.1 兵種地形速度表

| 兵種 \ 地形 | PLAIN | MOUNTAIN | WATER |
|-------------|-------|----------|-------|
| **Cavalry（騎兵）** | 2.0 | 0.5 | 0.2 |
| **Infantry（步兵）** | 1.0 | 1.2 | 0.8 |
| **Archer（弓兵）** | 0.8 | 0.8 | 1.5 |

#### 3.2.2 速度計算

```
ActualSpeed = Math.min(...ActiveTroopTypeSpeeds)
```

- 僅計算兵力 > 0 的兵種
- **體力懲罰：** 若 `stamina < 20`，則 `ActualSpeed = ActualSpeed / 2`

#### 3.2.3 尋路機制

- 抵達 Node 時自動將 `pathQueue[0]` 移入 `currentRouteId`
- 每 Tick `progress += ActualSpeed`
- 當 `progress ≥ route.distance` 時抵達下一節點

### 3.3 野戰引擎 (Combat Engine — Field)

#### 3.3.1 有效武力值

```
EffectiveMartial = Commander.martial
                 + (Deputy1.martial × 0.2)
                 + (Deputy2.martial × 0.2)
```

> 缺少副將時跳過對應項。

#### 3.3.2 總戰力 (TCP)

```
TCP = TotalTroops × (morale / 100) × (stamina / 100) × EffectiveMartial
```

#### 3.3.3 每 Tick 傷害

```
DamageDealt = (MyTCP / EnemyTCP) × 100
```

- 傷害從敵方 `TotalTroops` 扣除，各兵種平均分攤

#### 3.3.4 擊敗與俘虜

| 條件 | 結果 |
|------|------|
| 敵方 `TotalTroops ≤ 0` | 軍隊擊敗 |
| 主將俘虜機率 | `30 + (Victor.martial / 2)` % |
| 主將被俘且有副將 | `deputyIds[0]` 晉升為主將，士氣 −30 |
| 主將被俘且無副將 | 軍隊解散 |

### 3.4 攻城引擎 (Siege Engine)

#### 3.4.1 城牆減傷

```
Reduction% = (City.defense / City.maxDefense) × 0.8
```

#### 3.4.2 攻擊方傷害分配

- 基礎傷害沿用野戰公式計算
- 城市 TCP = `City.troops × 1 × 1 × Mayor.command`（無太守時 `command = 50`）

| 傷害目標 | 比例 | 計算方式 |
|----------|------|----------|
| **城牆** | 50% | `City.defense -= damage`（最低為 0） |
| **守軍** | 50% | `City.troops -= damage × (1 − Reduction%)` |

#### 3.4.3 佔領條件

- 當 `City.troops ≤ 0` 時，攻方佔領該節點，`ownerId` 變更

### 3.5 經濟引擎 (Economy Engine)

> 每 30 Ticks（遊戲內一個月）觸發一次。

#### 3.5.1 基礎產出常數

| 資源類型 | 基礎值 |
|----------|--------|
| Gold（金） | 1,000 |
| Food（糧） | 2,000 |
| Draft（徵兵） | 500 |

#### 3.5.2 政策產出公式

| 政策 | 產出公式 |
|------|----------|
| `POLICY_FOCUS_GOLD` | `gold += 1000 × (Mayor.politics / 50)` |
| `POLICY_FOCUS_FOOD` | `food += 2000 × (Mayor.politics / 50)` |
| `POLICY_FOCUS_DRAFT` | `troops += 500 × (Mayor.politics / 50)` |

> 若無太守，`politics` 以 25 計算。

---

## 4. Stage 1 劇本資料

> Loader 應將下列 JSON 解析為 `GameState`。完整型別見 `src/types.ts` 之 `Stage1Json`。

### 4.1 武將資料 (Officers)

```json
[
  {
    "id": "OFC_LIU",
    "name": "Liu Bei",
    "stats": { "command": 75, "martial": 70, "intel": 75, "politics": 80, "luck": 95 },
    "trait": "TRAIT_BENEVOLENT",
    "status": "IDLE",
    "locationId": "CITY_START",
    "ownerId": "FAC_SHU"
  },
  {
    "id": "OFC_GUAN",
    "name": "Guan Yu",
    "stats": { "command": 95, "martial": 98, "intel": 75, "politics": 60, "luck": 80 },
    "trait": "TRAIT_WARGOD",
    "status": "IDLE",
    "locationId": "CITY_START",
    "ownerId": "FAC_SHU"
  },
  {
    "id": "OFC_ZHANG",
    "name": "Zhang Fei",
    "stats": { "command": 85, "martial": 98, "intel": 30, "politics": 22, "luck": 60 },
    "trait": "TRAIT_FIERCE",
    "status": "IDLE",
    "locationId": "CITY_START",
    "ownerId": "FAC_SHU"
  }
]
```

### 4.2 節點資料 (Nodes)

```json
[
  {
    "id": "CITY_START",
    "name": "Base Camp",
    "type": "CITY",
    "ownerId": "FAC_SHU",
    "defense": 500,
    "maxDefense": 500,
    "resources": { "gold": 50000, "food": 50000, "troops": 15000 },
    "mayorId": "OFC_LIU",
    "policy": "POLICY_FOCUS_GOLD"
  },
  {
    "id": "GATE_TIGER",
    "name": "Tiger Gate",
    "type": "GATE",
    "ownerId": "FAC_ENEMY",
    "defense": 2000,
    "maxDefense": 2000,
    "resources": { "gold": 0, "food": 0, "troops": 3000 },
    "mayorId": null,
    "policy": "POLICY_BALANCED"
  },
  {
    "id": "CITY_TARGET",
    "name": "Pingyuan",
    "type": "CITY",
    "ownerId": "FAC_ENEMY",
    "defense": 1000,
    "maxDefense": 1000,
    "resources": { "gold": 5000, "food": 5000, "troops": 5000 },
    "mayorId": null,
    "policy": "POLICY_BALANCED"
  }
]
```

### 4.3 路線資料 (Routes)

```json
[
  {
    "id": "ROUTE_MAIN",
    "sourceNodeId": "CITY_START",
    "targetNodeId": "GATE_TIGER",
    "type": "PLAIN",
    "distance": 100,
    "isHidden": false
  },
  {
    "id": "ROUTE_BYPASS",
    "sourceNodeId": "CITY_START",
    "targetNodeId": "CITY_TARGET",
    "type": "MOUNTAIN",
    "distance": 300,
    "isHidden": true
  }
]
```

---

> **交叉參照：** 視圖層與資產架構請參閱 [Phase 5–6 規格書](phase5-6-spec.md)。  
> **下一階段：** Phase 5–6 將為本引擎加入 Canvas 渲染與 DOM UI 層。

