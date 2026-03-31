# 遊戲開發工具評估報告 — 2026 企業級方案

> **Project Dragon 龍騰** — 三國大戰略遊戲  
> **版本：** 1.0.0  
> **日期：** 2026-03  
> **目的：** 評估 2026 年最佳遊戲開發工具棧，為 Project Dragon 的技術演進提供決策依據

---

## 目錄

1. [當前技術棧分析](#1-當前技術棧分析)
2. [2D 遊戲引擎評估](#2-2d-遊戲引擎評估)
3. [渲染技術評估](#3-渲染技術評估)
4. [建構與開發工具](#4-建構與開發工具)
5. [桌面封裝方案](#5-桌面封裝方案)
6. [AI 美術生成工具](#6-ai-美術生成工具)
7. [推薦技術棧](#7-推薦技術棧)
8. [遷移路線圖](#8-遷移路線圖)

---

## 1. 當前技術棧分析

| 層級 | 技術 | 評估 |
|------|------|------|
| 語言 | TypeScript 5.9 | ✅ 業界標準，型別安全 |
| 建構 | Vite 5.x | ✅ 2026 仍為前端建構首選 |
| 渲染 | Canvas 2D API (Raw) | ⚠️ 缺乏精靈圖批次渲染、粒子系統、Shader 支援 |
| UI | 原生 HTML DOM | ⚠️ 可維護性隨功能增長下降 |
| 資產管理 | 自建 AssetManager | ⚠️ 缺乏精靈圖集（Sprite Atlas）、音訊管理 |
| 持久化 | IndexedDB | ✅ 適合客戶端存檔 |
| 測試 | tsx 腳本 | ⚠️ 缺乏自動化測試框架 |

### 核心優勢

- **零依賴架構**：執行時無外部依賴，啟動快、部署簡便
- **Headless Engine**：邏輯與渲染分離，可測試性高
- **確定性引擎**：相同輸入必定產生相同輸出

### 瓶頸

- 地圖渲染缺乏批次處理（Batching），大量精靈時效能受限
- 無粒子系統、Shader 或後處理效果
- 無音訊引擎
- 無正式測試框架

---

## 2. 2D 遊戲引擎評估

### 2.1 PixiJS v8

| 項目 | 評價 |
|------|------|
| **適用場景** | 高效能 2D 渲染、精靈圖批次處理、粒子特效 |
| **渲染後端** | WebGPU（首選）/ WebGL2 / Canvas 2D fallback |
| **優點** | 2026 年最成熟的 Web 2D 渲染器；TypeScript 原生支援；精靈圖集自動批次；富文本支援 |
| **缺點** | 僅處理渲染層，不包含遊戲邏輯框架；需自行整合 UI |
| **推薦度** | ⭐⭐⭐⭐⭐ **最佳渲染層選擇** |

**整合方式：** 保留現有 Headless Engine 不變，僅將 Canvas 2D 渲染層替換為 PixiJS。

### 2.2 Phaser v4

| 項目 | 評價 |
|------|------|
| **適用場景** | 完整 2D 遊戲框架（渲染 + 物理 + 音訊 + 輸入） |
| **渲染後端** | WebGL2 / Canvas 2D |
| **優點** | 完整遊戲框架；內建場景管理、輸入系統、Tween 動畫；龐大社群與插件生態 |
| **缺點** | 與自建 Headless Engine 有架構衝突；遊戲邏輯需適配 Phaser 場景模型 |
| **推薦度** | ⭐⭐⭐ 如重寫渲染層可考慮 |

### 2.3 Excalibur.js v0.29+

| 項目 | 評價 |
|------|------|
| **適用場景** | TypeScript-first 2D 遊戲引擎 |
| **渲染後端** | WebGL2 |
| **優點** | TypeScript 原生設計；ECS 架構；內建碰撞偵測、Tween 系統 |
| **缺點** | 社群規模小於 Phaser；文件較少 |
| **推薦度** | ⭐⭐⭐⭐ TypeScript 生態首選 |

### 2.4 Godot 4.x (Web Export)

| 項目 | 評價 |
|------|------|
| **適用場景** | 原生遊戲開發，導出 Web 版本 |
| **渲染後端** | Vulkan / WebGPU |
| **優點** | 完整遊戲引擎（2D/3D）；視覺化編輯器；GDScript/C# |
| **缺點** | 需重寫遊戲邏輯為 GDScript/C#；TypeScript 整合困難；Web 導出體積大 |
| **推薦度** | ⭐⭐ 若從零開始則考慮 |

### 2.5 引擎比較矩陣

| 特性 | PixiJS v8 | Phaser v4 | Excalibur | Godot 4 |
|------|-----------|-----------|-----------|---------|
| TypeScript 支援 | ✅ 原生 | ✅ 定義檔 | ✅ 原生 | ❌ |
| WebGPU 支援 | ✅ | ❌ | ❌ | ✅ |
| 精靈批次渲染 | ✅ | ✅ | ✅ | ✅ |
| 粒子系統 | ✅ | ✅ | ✅ | ✅ |
| 與現有引擎整合 | ✅ 極易 | ⚠️ 需適配 | ⚠️ 需適配 | ❌ 需重寫 |
| 學習成本 | 低 | 中 | 中 | 高 |
| 社群規模 | 大 | 大 | 中 | 大 |

---

## 3. 渲染技術評估

### 3.1 WebGPU

2026 年 WebGPU 已在主流瀏覽器（Chrome 113+、Firefox、Safari）全面支援。

| 優勢 | 說明 |
|------|------|
| **Compute Shader** | 可將 AI 引擎、路徑搜尋等計算密集型任務移至 GPU |
| **批次繪製** | 單次 Draw Call 渲染數千精靈 |
| **後處理效果** | 全螢幕迷霧、戰場特效、季節色調 |

**建議：** 透過 PixiJS v8 間接使用 WebGPU，無需直接操作低階 API。

### 3.2 Canvas 2D（現行方案）

| 優勢 | 劣勢 |
|------|------|
| 零依賴 | 無法批次渲染 |
| 相容性最佳 | 無 Shader 支援 |
| 程式碼直觀 | 大量精靈時效能差 |

**建議：** 短期內可保留，中期遷移至 PixiJS。

---

## 4. 建構與開發工具

### 4.1 建構工具

| 工具 | 推薦度 | 說明 |
|------|--------|------|
| **Vite 6.x** | ⭐⭐⭐⭐⭐ | 持續為 2026 前端建構首選；支援 HMR、ESM、Tree-shaking |
| **Turbopack** | ⭐⭐⭐⭐ | Vercel 推出的 Rust 建構器；目前仍以 Next.js 為主 |
| **esbuild** | ⭐⭐⭐⭐ | 極速 TypeScript 轉譯；Vite 底層已使用 |

### 4.2 測試框架

| 工具 | 推薦度 | 說明 |
|------|--------|------|
| **Vitest** | ⭐⭐⭐⭐⭐ | 與 Vite 原生整合；TypeScript 支援；快照測試；覆蓋率報告 |
| **Playwright** | ⭐⭐⭐⭐ | 瀏覽器 E2E 測試；可驗證 Canvas 渲染輸出 |

**建議：** 將現有 tsx 測試腳本遷移至 Vitest，獲得自動化 CI 支援。

### 4.3 程式碼品質

| 工具 | 推薦度 | 說明 |
|------|--------|------|
| **Biome** | ⭐⭐⭐⭐⭐ | Rust 實現的 Linter + Formatter；取代 ESLint + Prettier |
| **TypeScript Strict** | ✅ 已啟用 | 保持現有 strict 設定 |

### 4.4 CI/CD

| 工具 | 推薦度 | 說明 |
|------|--------|------|
| **GitHub Actions** | ⭐⭐⭐⭐⭐ | 與 GitHub 原生整合；免費額度充足 |
| **Changesets** | ⭐⭐⭐⭐ | 語義化版本管理；自動 Changelog 生成 |

---

## 5. 桌面封裝方案

### 5.1 Tauri v2

| 項目 | 評價 |
|------|------|
| **核心技術** | Rust + 系統 WebView |
| **應用體積** | ~2–5 MB（遠小於 Electron） |
| **效能** | 接近原生；Rust sidecar 可處理計算密集任務 |
| **平台支援** | Windows / macOS / Linux / iOS / Android |
| **推薦度** | ⭐⭐⭐⭐⭐ **2026 桌面封裝首選** |

### 5.2 Electron v33+

| 項目 | 評價 |
|------|------|
| **核心技術** | Chromium + Node.js |
| **應用體積** | ~80–150 MB |
| **效能** | 可接受；記憶體使用較高 |
| **推薦度** | ⭐⭐⭐ 若需要 Node.js API 或 Steam 深度整合 |

### 5.3 比較

| 指標 | Tauri v2 | Electron v33 |
|------|----------|--------------|
| 安裝體積 | ~3 MB | ~120 MB |
| 記憶體佔用 | ~30 MB | ~150 MB |
| 啟動速度 | <1s | 2–3s |
| Steam 整合 | ✅ (steamworks-rs) | ✅ (steamworks.js) |
| 跨平台 | ✅ + Mobile | ✅ Desktop only |

---

## 6. AI 美術生成工具

### 6.1 ComfyUI（已預留接口）

| 項目 | 評價 |
|------|------|
| **類型** | 本地 Stable Diffusion 工作流 |
| **接口** | REST API (`http://127.0.0.1:8188/prompt`) |
| **適用場景** | 武將肖像、城池精靈圖、地形貼圖 |
| **推薦度** | ⭐⭐⭐⭐⭐ 已預留 `ComfyUIService.ts` |

### 6.2 其他 AI 工具

| 工具 | 用途 | 推薦度 |
|------|------|--------|
| **Stable Diffusion XL / SD3** | 高品質 2D 美術生成 | ⭐⭐⭐⭐⭐ |
| **ControlNet** | 姿勢/構圖控制 | ⭐⭐⭐⭐ |
| **Suno / Udio** | AI 音樂生成（BGM） | ⭐⭐⭐⭐ |
| **ElevenLabs** | AI 語音生成（旁白） | ⭐⭐⭐ |

---

## 7. 推薦技術棧

### 短期方案（3 個月內）

維持當前 Vanilla TypeScript + Canvas 2D 架構，強化工具鏈：

```
TypeScript 5.9 + Vite 6 + Vitest + Biome
Canvas 2D + Camera/Viewport 系統（已實作）
IndexedDB + ComfyUI
```

### 中期方案（6–12 個月）

渲染層升級至 PixiJS v8：

```
TypeScript 5.x + Vite 6 + Vitest + Biome
PixiJS v8 (WebGPU) + 現有 Headless Engine
Tauri v2 桌面封裝
ComfyUI + Stable Diffusion 美術管線
```

### 長期方案（12+ 個月）

完整遊戲平台：

```
TypeScript 5.x + Vite + Vitest + Biome + Playwright
PixiJS v8 (WebGPU) + Web Audio API + i18n 擴展
Tauri v2 + Steam 整合
WebSocket 多人對戰伺服器
ComfyUI 全自動美術管線
Modding API（Phase 15）
```

---

## 8. 遷移路線圖

| 階段 | 工具升級 | 優先級 | 預估工時 |
|------|----------|--------|----------|
| **S1** | Vitest 測試框架導入 | P0 | 1 週 |
| **S1** | Biome linter/formatter 導入 | P0 | 0.5 週 |
| **S2** | PixiJS v8 渲染層替換 | P1 | 3 週 |
| **S2** | Web Audio 音效引擎 | P1 | 2 週 |
| **S3** | Tauri v2 桌面封裝 | P2 | 2 週 |
| **S3** | ComfyUI 美術管線自動化 | P2 | 2 週 |
| **S4** | WebSocket 多人架構 | P3 | 4 週 |

---

> **結論：** Project Dragon 的 Headless Engine 架構是其最大優勢——邏輯層完全不受渲染技術影響。建議短期先強化工具鏈（Vitest + Biome），中期將渲染層升級至 PixiJS v8 以獲得 WebGPU 效能與粒子特效支援，長期透過 Tauri v2 實現桌面發行。
