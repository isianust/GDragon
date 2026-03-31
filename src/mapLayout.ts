/**
 * @file 地圖節點世界座標佈局。
 *
 * 定義每個節點在「世界座標空間 (World Space)」中的位置。
 * 世界座標與螢幕座標的轉換由 {@link Camera} 負責。
 *
 * 設計理念：
 * - 使用較大的世界座標範圍（0–2000+），支援 Vampire Survivors 風格的大地圖瀏覽
 * - Tower Defense 的固定路線行走由 Route 資料驅動，視覺化時在節點間繪製路徑
 * - 新增節點只需在此處增加座標即可，無需修改渲染邏輯
 */

import type { WorldBounds } from "./camera.ts";

/**
 * 世界座標佈局（Stage 1）。
 *
 * 座標系：右為 +X，下為 +Y（與 Canvas 預設一致）。
 * 佈局範圍約 0–2000，攝影機預設視野可覆蓋全部或部分區域。
 */
export const NODE_WORLD_POSITIONS: Record<string, { x: number; y: number }> = {
  CITY_START:  { x: 300,  y: 600 },
  GATE_TIGER:  { x: 1000, y: 420 },
  CITY_TARGET: { x: 1700, y: 600 },
};

/**
 * Stage 1 世界邊界（供 Camera 限制平移範圍）。
 * 留有 200px 邊距以便地圖邊緣不會緊貼螢幕。
 */
export const STAGE1_WORLD_BOUNDS: WorldBounds = {
  minX: 0,
  minY: 0,
  maxX: 2000,
  maxY: 1000,
};

/**
 * @deprecated 改用 {@link NODE_WORLD_POSITIONS}。
 * 為向後相容保留的舊版螢幕空間座標（映射至世界座標）。
 */
export const NODE_SCREEN_POSITIONS = NODE_WORLD_POSITIONS;
