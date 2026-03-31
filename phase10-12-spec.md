# Phase 10–12：沙盒・地緣政治與災厄引擎規格書

> **Project Dragon 龍騰** — 三國大戰略遊戲  
> **版本：** 1.0.0-draft  
> **日期：** 2025-07  
> **負責模組：** SandboxEngine, GeopoliticsEngine, CatastropheEngine  
> **相關原始碼：** `src/CatastropheEngine.ts`, `src/types.ts`  
> **前置依賴：** [Phase 1–4](phase1-4-spec.md)、[Phase 5–6](phase5-6-spec.md)、[Phase 7–9](phase7-9-spec.md)

---

## 目錄

1. [資料模型擴充](#1-資料模型擴充)  
2. [地緣政治與大戰略](#2-地緣政治與大戰略)  
3. [動態沙盒與流浪機制](#3-動態沙盒與流浪機制)  
4. [市政生態與災厄引擎](#4-市政生態與災厄引擎)  

---

## 1. 資料模型擴充

> 於 Phase 7–9 既有 Interface 上新增屬性，完整型別定義見 `src/types.ts`。

### 1.1 Faction 擴充

```typescript
export interface Faction {
  // ... 既有屬性
  type: "WARLORD" | "HORDE" | "BANDIT" | "PIRATE";
  allianceId: string | null;   // 聯盟用途
  isRebel: boolean;
  activeEdict: "NONE" | "EDICT_TUNTIAN" | "EDICT_CONSCRIPTION" | "EDICT_MERITOCRACY";
  edictDuration: number;       // 剩餘 Tick 數（最大 360）
}
```

### 1.2 MapNode 擴充

```typescript
export interface MapNode {
  // ... 既有屬性
  hasEmperor: boolean;
  population: number;
  publicOrder: number;   // 0–100
  isPlagued: boolean;
  // 注意：policy 新增 "POLICY_RESTORE_ORDER"
}
```

### 1.3 Officer 擴充

```typescript
export interface Officer {
  // ... 既有屬性
  loyalty: number;          // 0–100
  ambition: number;         // 0–100
  bondIds: string[];        // 結義武將 ID 陣列
  feudFactionId: string | null;  // 世仇勢力 ID
}
```

---

## 2. 地緣政治與大戰略

> Phase 10 核心功能。

### 2.1 天子與聯盟 (The Emperor & Coalitions)

#### 2.1.1 天子節點

- 控制 `hasEmperor: true` 節點的勢力每 30 Ticks 獲得 `globalPrestige += 5`
- 每年（360 Ticks）可發布一道詔令，將目標勢力標記為 `isRebel: true`
- 叛賊效果：士氣懲罰 −20%，持續 6 個月（180 Ticks）

#### 2.1.2 動態聯盟 (Dynamic Coalition)

每月（30 Ticks）檢查：

| 觸發條件 | 結果 |
|----------|------|
| 任一勢力 `globalPrestige > 80` **且** 控制節點 > 總數 30% | 觸發 `COALITION_EVENT` |
| `globalPrestige < 50` 的獨立 AI 勢力 | 自動結盟（`allianceId = "COALITION_AGAINST_[Target]"`），協調攻擊目標，持續 1 年 |

### 2.2 結義與世仇 (Bonds & Feuds)

| 系統 | 觸發條件 | 效果 |
|------|----------|------|
| **世仇 (Feud)** | 勢力 A 處決武將 | 受害者的結義兄弟（`bondIds`）將 `feudFactionId` 設為勢力 A；對勢力 A 戰鬥時：俘虜機率 0%、士氣鎖定 100、武力 +20 |
| **結義 (Bond)** | 主將與副將共享 `bondIds` | 軍隊獲得 **+30% 總戰力 (TCP)** |

### 2.3 大詔令 (Grand Edicts)

> 統治者每年（360 Ticks）可頒布一道詔令。

| 詔令 | 效果 | 代價 |
|------|------|------|
| `EDICT_TUNTIAN`（屯田） | 行軍軍隊糧食消耗 −50% | — |
| `EDICT_CONSCRIPTION`（強制徵兵） | 徵兵產出 +100% | 城市糧食產出 −30% |
| `EDICT_MERITOCRACY`（唯才是舉） | 武將忠誠度下降暫停；俘虜機率 +20% | — |

---

## 3. 動態沙盒與流浪機制

> Phase 11 核心功能。

### 3.1 遊牧化 (Horde Mechanic)

| 觸發條件 | 結果 |
|----------|------|
| `WARLORD` 勢力失去最後一個節點 | `type` 變為 `HORDE`，資源轉移至統治者軍隊 |
| 統治者軍隊被消滅 | 勢力徹底覆滅 |

### 3.2 劫掠指令 (Pillage Command)

- 適用勢力：`HORDE` 或 `BANDIT`
- 可對節點執行 `PILLAGE`（取代 `SIEGE`）
- 效果：即時掠奪一定比例的金幣 / 糧食，降低防禦值，但**不佔領城市**

### 3.3 豎旗自立 (Raise Banner)

| 條件 | 結果 |
|------|------|
| `FREE` 狀態武將且 `ambition > 70` | — |
| 抵達空城或駐軍 < 1,000 的節點 | 即時建立新勢力，生成 2,000 民兵，該武將成為統治者 |

---

## 4. 市政生態與災厄引擎

> Phase 12 核心功能。更新 `EconomyEngine`（每月 / 30 Ticks）並建立 `CatastropheEngine`（每年 / 360 Ticks）。

### 4.1 治安與飢荒 (Public Order & Starvation)

#### 4.1.1 治安系統

- `publicOrder` 自然趨向 50
- 戰爭疲勞（城市遭攻擊）：治安 −10
- `POLICY_RESTORE_ORDER`：消耗金幣提升治安

#### 4.1.2 飢荒後果

> 當城市 `food ≤ 0` 時觸發：

| 效果 | 數值 |
|------|------|
| 守軍逃散 | 20% 兵力流失 |
| 武將忠誠 | −10 Loyalty |

#### 4.1.3 暴動觸發 (Riot Trigger)

| 條件 | 結果 |
|------|------|
| `publicOrder < 20` **且** `food ≤ 0` | 50% 機率觸發暴動 |
| **暴動效果** | 城市損失 50% 金幣；防禦 −200；即時生成 `BANDIT` 勢力並在該節點發動攻城 |

### 4.2 災厄引擎 (Catastrophe Engine — Yearly Roll)

> 每年（360 Ticks）進行災厄骰定。相關原始碼：`src/CatastropheEngine.ts`。

| 災厄 | 影響範圍 | 效果 |
|------|----------|------|
| **蝗災 (Locust Swarm)** | 1 座隨機城市 + 相連節點 | 糧食歸零；人口 −10% |
| **瘟疫 (Plague)** | 單一節點 `isPlagued = true`，持續 3 個月 | 守軍每 Tick −5%；武將需通過 `luck` 檢定，否則染病（全能力 −50%） |
| **地震 / 水災 (Earthquake / Flood)** | 山地 / 水域節點 | 防禦值歸零；即時摧毀受影響路線上行軍中的軍隊 |

---

> **交叉參照：** AI 引擎邏輯請參閱 [Phase 7–9 規格書](phase7-9-spec.md)。  
> **下一階段：** Phase 13–15 將加入外交系統、多人架構與終局系統，請參閱 [Phase 13–15 規格書](phase13-15-spec.md)。