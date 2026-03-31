# Phase 5–6：視圖層與資產架構規格書

> **Project Dragon 龍騰** — 三國大戰略遊戲  
> **版本：** 1.0.0-draft  
> **日期：** 2026-03  
> **負責模組：** View Layer, Asset Pipeline  
> **相關原始碼：** `src/mapCanvas.ts`, `src/AssetManager.ts`, `src/ComfyUIService.ts`, `src/style.css`  
> **前置依賴：** [Phase 1–4 核心引擎](phase1-4-spec.md)

---

## 目錄

1. [混合渲染架構](#1-混合渲染架構)  
2. [資產管理系統](#2-資產管理系統)  
3. [資料模型擴充](#3-資料模型擴充)  
4. [Canvas 繪製規則](#4-canvas-繪製規則)  
5. [DOM UI 元件與互動](#5-dom-ui-元件與互動)  
6. [狀態持久化](#6-狀態持久化)  

---

## 1. 混合渲染架構

### 1.1 架構分層

視圖層嚴格分離 **地圖渲染** 與 **使用者介面**，確保效能最佳化。

| 層級 | 技術 | 職責 |
|------|------|------|
| **Canvas (`<canvas>`)** | 2D Context / `requestAnimationFrame` | 僅負責世界地圖渲染：Route、Node、行軍中的 Army |
| **HTML DOM** | Absolute-positioned Overlays | 所有 UI 面板：選單、頂部列、Modal、資源列 |

### 1.2 元件層級圖

```
┌─────────────────────────────────────────┐
│  Browser Viewport                       │
│  ┌───────────────────────────────────┐  │
│  │  <canvas id="map">               │  │
│  │   ├─ Route Layer (lines)         │  │
│  │   ├─ Node Layer (cities/gates)   │  │
│  │   └─ Army Layer (icons/glyphs)   │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │  DOM Overlay (z-index: 10+)      │  │
│  │   ├─ GlobalHeader                │  │
│  │   ├─ TimeControls                │  │
│  │   ├─ NodeContextMenu             │  │
│  │   └─ ArmyDispatchModal           │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

---

## 2. 資產管理系統

> Phase 6 引入 `AssetManager` Singleton，為後續 AI 生成美術（ComfyUI）做好準備。

### 2.1 AssetManager 規格

| 項目 | 規格 |
|------|------|
| **設計模式** | Singleton |
| **預載機制** | 將圖片載入 `Map<string, HTMLImageElement>`，於引擎渲染啟動前完成 |
| **Fallback 機制** | 若圖片 URL 遺失或載入失敗，回傳 `null`；Canvas 以幾何圖形替代（`fillRect`、`arc`）。**禁止因缺圖而崩潰** |
| **相關原始碼** | `src/AssetManager.ts` |

### 2.2 資產目錄結構

```
public/
└── assets/
    ├── portraits/    # 武將頭像
    ├── nodes/        # 城市 / 關卡 Sprite
    └── ui/           # UI 圖示與裝飾
```

### 2.3 ComfyUI 整合預留

- 建立 `src/ComfyUIService.ts`（空實作 + 註解）
- 未來將呼叫本地 API：`http://127.0.0.1:8188/prompt`
- 用於動態生成武將肖像、城市場景等美術素材

---

## 3. 資料模型擴充

> 在 Phase 1–4 原有 Interface 基礎上新增視覺資產欄位，**不刪除任何既有屬性**。

### 3.1 擴充欄位一覽

| Interface | 新增欄位 | 型別 | 說明 |
|-----------|----------|------|------|
| `Officer` | `portraitAssetId` | `string?` | 肖像圖片 Asset ID |
| `Officer` | `avatarAssetId` | `string?` | 地圖頭像 Asset ID |
| `MapNode` | `spriteAssetId` | `string?` | 城市 / 關卡 Sprite Asset ID |
| `Route` | `textureAssetId` | `string?` | 路線紋理 Asset ID |

### 3.2 TypeScript 範例

```typescript
export interface Officer {
  // ... Phase 1–4 既有屬性
  portraitAssetId?: string;
  avatarAssetId?: string;
}

export interface MapNode {
  // ... Phase 1–4 既有屬性
  spriteAssetId?: string;
}

export interface Route {
  // ... Phase 1–4 既有屬性
  textureAssetId?: string;
}
```

---

## 4. Canvas 繪製規則

> 於 `requestAnimationFrame` 迴圈內，依下列順序繪製。

### 4.1 Route（路線）繪製

| 路線類型 | 樣式 | 備註 |
|----------|------|------|
| `PLAIN` | 寬實線（米色 `beige`） | — |
| `MOUNTAIN` | 窄實線（棕色 `brown`） | — |
| `WATER` | 實線（藍色 `blue`） | — |

> **注意：** 若 `isHidden === true`，在未揭露前 **不繪製**。

### 4.2 Node（城市 / 關卡）繪製

- 依 `(x, y)` 座標繪製
- 優先使用 `AssetManager.get(spriteAssetId)` 取得 Sprite
- **Fallback：**
  - `CITY`：大方塊（勢力色）
  - `GATE`：矩形城牆
- 節點下方標示名稱與駐軍數量

### 4.3 Army（軍隊）繪製

- **位置計算：** 依 `Army.progress / Route.distance` 在起訖節點間內插
- 優先繪製 `avatarAssetId`（裁切為圓形）
- **Fallback：** 繪製彩色圓形 + 主將姓名首字
- 若 `status === "COMBAT"` 或 `"SIEGE"`：於軍隊圖示上方疊加交叉劍圖示

---

## 5. DOM UI 元件與互動

### 5.1 CSS 設計規範 (Glassmorphism)

| 屬性 | 值 |
|------|-----|
| `backdrop-filter` | `blur(10px)` |
| `background` | `rgba(15, 23, 42, 0.8)` |
| `font-family` | `system-ui, "Roboto", sans-serif` |
| `transition` | `all 0.2s ease`（hover 狀態） |
| `border` | `1px solid rgba(255, 255, 255, 0.1)` |
| `border-radius` | `8px` |

### 5.2 元件規格

#### 5.2.1 Global Header（全域頂部列）

- 顯示玩家勢力的總金幣、總糧食
- 顯示當前日期（由 `currentTick` 換算）

#### 5.2.2 Time Controls（時間控制）

- 按鈕組：`[ 暫停 ]` `[ 1x ]` `[ 2x ]` `[ 4x ]`
- 點擊後修改 Headless Engine 的 TimeScale

#### 5.2.3 Node Context Menu（節點右鍵選單）

- **觸發：** 點擊 Canvas 上的節點
- **顯示：** 防禦值、金幣、糧食、駐軍
- **操作按鈕：**
  - 指派太守 (Assign Mayor)
  - 設定政策 (Set Policy)：Gold / Food / Draft
  - 出征 (Dispatch Army) → 開啟 Dispatch Modal

#### 5.2.4 Army Dispatch Modal（出征面板）

| 欄位 | 說明 |
|------|------|
| 主將選擇 | 選擇 1 名 Commander |
| 副將選擇 | 最多 2 名 Deputies |
| 兵力 / 糧食 | Input / Slider 控制攜帶數量 |
| 目標節點 | 選擇目標 Node |
| 確認 | 觸發引擎建立 Army 並寫入 `GameState` |

---

## 6. 狀態持久化

> 使用 `IndexedDB`（或輕量封裝如 `localforage`）繞過 `localStorage` 5 MB 限制。

### 6.1 API 規格

| 函式 | 說明 |
|------|------|
| `exportGameState()` | 序列化整個 `GameState`（Tick、Officers、Nodes、Routes、Armies）為 JSON 並存入 IndexedDB |
| `importGameState()` | 從 IndexedDB 載入 JSON，完全覆寫引擎當前狀態，強制 Canvas 重新繪製 |

### 6.2 自動存檔

- 每 30 Ticks（經濟結算後）靜默觸發自動存檔
- 不中斷遊戲流程

---

> **交叉參照：** 核心引擎邏輯請參閱 [Phase 1–4 規格書](phase1-4-spec.md)。  
> **下一階段：** Phase 7–9 將加入戰爭迷霧、天氣系統與 AI 引擎，請參閱 [Phase 7–9 規格書](phase7-9-spec.md)。