# 貢獻指南 · Contributing Guide

## 歡迎

感謝您對 **Project Dragon（龍騰）** 的關注！本專案是一款以三國為背景的大戰略遊戲引擎，採用純 TypeScript 構建，零外部 runtime 依賴。無論是修正 bug、新增功能、改善文件或翻譯，我們都歡迎您的貢獻。

請在開始之前閱讀本指南，確保您的貢獻能順利融入專案。

---

## 開發環境設定

### 系統需求

| 工具      | 最低版本  |
|-----------|----------|
| Node.js   | ≥ 18.x  |
| npm       | ≥ 9.x   |

### 快速開始

```bash
# 1. Clone 專案
git clone <repository-url>
cd GDragon

# 2. 安裝依賴
npm install

# 3. 啟動開發伺服器
npm run dev
# → http://127.0.0.1:5173/

# 4. 建置並驗證
npm run build

# 5. 執行測試
npm run test:engine   # 引擎邏輯測試（100 ticks）
npm run test:ai       # AI 決策測試（900 ticks）
npm run test:riot     # 暴動 / 災害事件測試
```

### 可用指令

| 指令                 | 說明                              |
|----------------------|----------------------------------|
| `npm run dev`        | 啟動 Vite 開發伺服器 (port 5173)  |
| `npm run build`      | TypeScript 編譯 + Vite 生產建置    |
| `npm run preview`    | 預覽生產建置 (port 4173)           |
| `npm run test:engine`| 執行引擎邏輯自測                   |
| `npm run test:ai`    | 執行 AI 決策自測                   |
| `npm run test:riot`  | 執行暴動 / 災害事件測試             |

---

## 專案結構

本專案採用 **Headless Engine + View Layer** 分離架構。核心引擎可在 Node.js 中無 DOM 依賴獨立運行。

```
src/
├── tickEngine.ts          # 主模擬迴圈，子系統協調器
├── simulationScheduler.ts # RAF 排程器，timeScale 控制
├── types.ts               # 所有 TypeScript 介面與型別定義
├── main.ts                # UI 進入點
│
├── engine/                # TickEngine 呼叫的子系統模組
│   ├── logistics.ts       # 糧草消耗、飢餓
│   ├── movement.ts        # 行軍進度、地形 / 天氣修正
│   ├── collision.ts       # 碰撞偵測（→ 野戰 / → 攻城）
│   ├── combat.ts          # 野戰解算（TCP 公式）
│   ├── siege.ts           # 攻城傷害、城池攻佔
│   ├── economy.ts         # 月結生產、民心、暴動
│   ├── formation.ts       # 編隊計算
│   └── pillage.ts         # 掠奪機制
│
├── AIEngine.ts            # AI 決策引擎
├── EnvironmentEngine.ts   # 季節循環、天氣生成
├── FogOfWarEngine.ts      # 戰爭迷霧（BFS 可見度）
├── CatastropheEngine.ts   # 年末災害事件
│
├── i18n/                  # 國際化模組
│   ├── i18n.ts
│   ├── localeId.ts
│   └── messages/          # 語系檔（en, zhHans, zhHant）
│
├── mapCanvas.ts           # Canvas 2D 世界地圖渲染
└── gamePersistence.ts     # IndexedDB 存檔 / 讀檔
```

> 📖 完整架構文件請參閱 [ARCHITECTURE.md](./ARCHITECTURE.md)。

---

## 開發工作流程

### Branch 命名規範

| 類型      | 格式                         | 範例                                |
|-----------|------------------------------|-------------------------------------|
| 功能開發   | `feat/<簡述>`                | `feat/diplomacy-system`             |
| Bug 修正  | `fix/<簡述>`                 | `fix/combat-retreat-crash`          |
| 文件更新   | `docs/<簡述>`                | `docs/update-architecture`          |
| 重構      | `refactor/<簡述>`            | `refactor/tick-engine-phases`       |
| 測試      | `test/<簡述>`                | `test/siege-edge-cases`             |

### Commit Message 規範

本專案遵循 [Conventional Commits](https://www.conventionalcommits.org/) 格式：

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

**Type 列表：**

| Type       | 用途               |
|------------|-------------------|
| `feat`     | 新功能             |
| `fix`      | Bug 修正           |
| `docs`     | 文件變更           |
| `refactor` | 重構（不影響功能）   |
| `test`     | 測試相關           |
| `perf`     | 效能優化           |
| `chore`    | 建置 / 工具鏈變更   |

**Scope 範例：** `engine`, `combat`, `economy`, `ai`, `i18n`, `renderer`, `persistence`

**範例：**

```
feat(engine): add diplomacy subsystem

- Implement alliance proposal / acceptance logic
- Add DiplomacyState interface to types.ts
- Register in TickEngine monthly phase
```

### Pull Request 流程

1. 從最新的主分支建立 feature branch
2. 開發並確保所有測試通過：
   ```bash
   npm run build && npm run test:engine && npm run test:ai
   ```
3. 提交 PR，描述中應包含：
   - **變更摘要**：做了什麼、為什麼
   - **測試方式**：如何驗證此變更
   - **相關 Issue**：如有，請連結
4. 等待 code review 並回應審查意見
5. 合併前確保 CI 全部通過

---

## 程式碼風格

### TypeScript 設定

本專案啟用嚴格模式（`tsconfig.json`）：

- ✅ `strict: true` — 啟用所有嚴格型別檢查
- ✅ `noUnusedLocals: true` — 禁止未使用的區域變數
- ✅ `noUnusedParameters: true` — 禁止未使用的函式參數
- ✅ `noFallthroughCasesInSwitch: true` — 禁止 switch fall-through
- ✅ Target: `ES2023` / Module: `ESNext`

### 命名慣例

| 元素                          | 風格               | 範例                            |
|-------------------------------|--------------------|---------------------------------|
| 變數、函式                     | `camelCase`        | `armyCount`, `calculateDamage`  |
| 型別、介面、類別                | `PascalCase`       | `GameState`, `TickEngine`       |
| Enum 成員                     | `UPPER_SNAKE_CASE` | `AGGRESSIVE`, `ROUTE_WEATHER`   |
| 常數                          | `UPPER_SNAKE_CASE` | `TICKS_PER_DAY`, `MAX_MORALE`   |
| 檔案名稱（模組）               | `camelCase`        | `tickEngine.ts`, `gameState.ts` |
| 檔案名稱（類別）               | `PascalCase`       | `AIEngine.ts`, `FogOfWarEngine.ts` |

### 程式碼原則

- **禁止使用 `any` 型別** — 使用 `unknown` 並搭配型別守衛 (type guard)
- **所有公開函式必須標註回傳型別**
- **優先使用 `Map` / `Set`** 進行查找，避免 O(n) 陣列搜尋
- **單一函式不超過 100 行**（複雜邏輯應拆分為子函式）
- **Mutable GameState 模式** — 非 Redux / immutable；子系統直接修改 `GameState`
- **確定性 (Deterministic)** — 相同輸入必須產生相同輸出，禁止在引擎邏輯中使用 `Math.random()`（使用 seeded PRNG）

---

## 測試

### 執行測試

```bash
# 執行所有測試
npm run test:engine && npm run test:ai && npm run test:riot

# 單獨執行
npm run test:engine   # 引擎 100 ticks 模擬
npm run test:ai       # AI 決策 900 ticks 模擬
npm run test:riot     # 暴動 / 災害事件驗證
```

### 測試架構

本專案使用 `tsx` 直接執行 TypeScript 測試檔案，無外部測試框架。測試利用 Headless Engine 在 Node.js 中無 DOM 依賴地運行。

### 新增測試

1. 在 `src/` 下建立測試檔案，命名慣例：`<描述>-test.ts` 或 `test<描述>.ts`
2. 使用 `loaderNode.ts` 載入場景資料
3. 建立 `TickEngine` 實例並執行模擬
4. 驗證 `TickResult` 輸出

```typescript
// 範例：src/myFeature-test.ts
import { loadScenarioNode } from './loaderNode';
import { TickEngine } from './tickEngine';

const state = loadScenarioNode('data/stage1.json');
const engine = new TickEngine();

for (let i = 0; i < 100; i++) {
  const result = engine.tick(state);
  // 驗證結果...
}
console.log('✅ myFeature test passed');
```

5. 在 `package.json` 中新增對應 script：
   ```json
   "test:myFeature": "tsx src/myFeature-test.ts"
   ```

---

## 國際化 (i18n)

### 支援語系

| Locale ID  | 語言     | 檔案                            |
|------------|---------|--------------------------------|
| `zh-Hant`  | 繁體中文 | `src/i18n/messages/zhHant.ts`  |
| `zh-Hans`  | 簡體中文 | `src/i18n/messages/zhHans.ts`  |
| `en`       | English | `src/i18n/messages/en.ts`      |

**預設語系：** `zh-Hant`（繁體中文）

### 新增 / 編輯翻譯

1. 在三個語系檔中同步新增翻譯鍵值：

```typescript
// src/i18n/messages/zhHant.ts
export default {
  // ...existing keys
  "diplomacy.propose": "提議同盟",
};

// src/i18n/messages/zhHans.ts
export default {
  // ...existing keys
  "diplomacy.propose": "提议同盟",
};

// src/i18n/messages/en.ts
export default {
  // ...existing keys
  "diplomacy.propose": "Propose Alliance",
};
```

2. 在 UI 程式碼中使用 `t()` 函式：

```typescript
import { t } from './i18n/i18n';

const label = t('diplomacy.propose');
// 支援變數插值
const msg = t('header.calendar', { day: 5, branch: '甲子', half: '上' });
```

### 翻譯鍵值命名規範

- 使用 dot-notation 分層：`<模組>.<動作/屬性>`
- 範例：`"header.gold"`, `"status.bilingual.IDLE"`, `"combat.retreat"`
- 所有新功能**必須同時提供三種語系的翻譯**

---

## 新增遊戲系統

當您需要新增一個引擎子系統時，請遵循以下步驟：

### 1. 定義型別

在 `src/types.ts` 中新增相關介面與型別：

```typescript
export interface DiplomacyState {
  alliances: Alliance[];
  proposals: Proposal[];
}
```

### 2. 建立引擎模組

在 `src/engine/` 目錄下建立新檔案：

```typescript
// src/engine/diplomacy.ts
import type { GameState } from '../types';

export interface DiplomacyLog {
  allianceFormed: string[];
  proposalsSent: string[];
}

export function tickDiplomacy(state: GameState): DiplomacyLog {
  const log: DiplomacyLog = { allianceFormed: [], proposalsSent: [] };
  // 實作邏輯...
  return log;
}
```

### 3. 註冊至 TickEngine

在 `src/tickEngine.ts` 的 `tick()` 方法中，按照正確的執行階段插入呼叫：

```typescript
// 在 tick() 方法的適當階段加入
const diplomacyLog = tickDiplomacy(state);
result.diplomacy = diplomacyLog;
```

> ⚠️ **執行順序至關重要。** TickEngine 有 18 個執行階段，請參閱 [ARCHITECTURE.md](./ARCHITECTURE.md) 確認正確的插入位置。

### 4. 新增測試

為新系統建立獨立測試，確保邏輯正確且具確定性。

### 5. 更新文件

- 更新 `ARCHITECTURE.md` 中的系統描述
- 新增 i18n 翻譯鍵值（三種語系）
- 更新 `README.md` 中的功能列表

---

## 文件規範

### JSDoc 要求

所有公開的函式、類別、介面必須附帶 JSDoc 註解：

```typescript
/**
 * 計算野戰傷害值（TCP 公式）。
 *
 * @param attacker - 攻擊方軍隊
 * @param defender - 防禦方軍隊
 * @param terrain - 地形修正係數
 * @returns 雙方傷亡數據
 */
export function calculateCombatDamage(
  attacker: Army,
  defender: Army,
  terrain: number,
): CombatResult {
  // ...
}
```

### 文件撰寫原則

- **ARCHITECTURE.md** — 系統架構總覽，新增子系統時須同步更新
- **README.md** — 專案概述、快速開始、功能列表
- **程式碼內註解** — 僅在複雜演算法或非直覺邏輯處加註；避免顯而易見的註解
- **Phase Spec 文件** — `phase*-spec.md` 為規格書，勿直接修改

---

## 問題回報

提交 Issue 時，請包含以下資訊：

### Bug 回報

```
### 問題描述
簡述遭遇的問題。

### 重現步驟
1. 執行 `npm run dev`
2. 選擇勢力 X
3. 派遣軍隊至 Y 城
4. 觀察到 Z 異常行為

### 預期行為
描述正確行為應該是什麼。

### 實際行為
描述實際發生了什麼。

### 環境資訊
- OS: [e.g., macOS 14.2, Windows 11, Ubuntu 22.04]
- Node.js: [e.g., 20.11.0]
- Browser: [e.g., Chrome 121]
```

### 功能請求

```
### 功能描述
簡述您希望新增的功能。

### 使用情境
描述此功能解決的問題或帶來的價值。

### 建議實作方式（選填）
如有想法，描述可能的實作方向。
```

---

## 授權

本專案的授權條款**尚未確定 (TBD)**。在正式授權確認之前，您提交的所有貢獻將被視為同意未來採用的授權條款。

如有授權相關疑問，請在 Issue 中提出討論。

---

> 📖 **相關文件：** [README.md](./README.md) · [ARCHITECTURE.md](./ARCHITECTURE.md)
