/**
 * @file 攝影機與視口系統。
 *
 * 提供 Vampire Survivors 風格的大地圖瀏覽體驗：
 * - 滑鼠拖曳平移（Pan）
 * - 滾輪縮放（Zoom）
 * - 世界座標 ↔ 螢幕座標雙向轉換
 * - 邊界限制（Clamping）
 *
 * 設計理念：
 * 引擎層使用「世界座標 (World Coordinates)」定義節點與路線位置，
 * Camera 負責將世界座標映射至螢幕座標（Screen Coordinates），
 * 實現與 Tower Defense 遊戲相同的固定路線視覺化效果。
 */

export interface WorldBounds {
  /** 世界左邊界 X 值。 */
  minX: number;
  /** 世界上邊界 Y 值。 */
  minY: number;
  /** 世界右邊界 X 值。 */
  maxX: number;
  /** 世界下邊界 Y 值。 */
  maxY: number;
}

/**
 * 2D 攝影機，管理視口位置與縮放等級。
 *
 * 使用方式：
 * 1. 建立 Camera 實例並設定世界邊界
 * 2. 呼叫 `bindToCanvas(canvas)` 綁定互動事件
 * 3. 繪製前呼叫 `applyTransform(ctx)` 設定 Canvas 變換矩陣
 * 4. 使用 `worldToScreen()` / `screenToWorld()` 進行座標轉換
 */
export class Camera {
  /** 攝影機在世界座標中的中心 X 位置。 */
  x = 0;
  /** 攝影機在世界座標中的中心 Y 位置。 */
  y = 0;
  /** 當前縮放等級（1.0 = 100%）。 */
  zoom = 1.0;

  /** 最小縮放（最遠俯瞰）。 */
  readonly minZoom = 0.25;
  /** 最大縮放（最近特寫）。 */
  readonly maxZoom = 3.0;

  /** 世界座標邊界，用於限制攝影機平移範圍。 */
  bounds: WorldBounds = { minX: -500, minY: -500, maxX: 2500, maxY: 1500 };

  /** 視口寬度（像素，由 resize 更新）。 */
  private viewportW = 0;
  /** 視口高度（像素，由 resize 更新）。 */
  private viewportH = 0;

  /* --- 拖曳狀態 --- */
  private dragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private camStartX = 0;
  private camStartY = 0;

  /** 更新視口尺寸（應於 canvas resize 後呼叫）。 */
  setViewport(width: number, height: number): void {
    this.viewportW = width;
    this.viewportH = height;
  }

  /** 限制攝影機位置在世界邊界內。 */
  private clamp(): void {
    const halfW = (this.viewportW / 2) / this.zoom;
    const halfH = (this.viewportH / 2) / this.zoom;
    this.x = Math.max(this.bounds.minX + halfW, Math.min(this.bounds.maxX - halfW, this.x));
    this.y = Math.max(this.bounds.minY + halfH, Math.min(this.bounds.maxY - halfH, this.y));
  }

  /**
   * 世界座標 → 螢幕座標。
   */
  worldToScreen(wx: number, wy: number): { x: number; y: number } {
    return {
      x: (wx - this.x) * this.zoom + this.viewportW / 2,
      y: (wy - this.y) * this.zoom + this.viewportH / 2,
    };
  }

  /**
   * 螢幕座標 → 世界座標。
   */
  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return {
      x: (sx - this.viewportW / 2) / this.zoom + this.x,
      y: (sy - this.viewportH / 2) / this.zoom + this.y,
    };
  }

  /**
   * 對 Canvas 2D context 套用攝影機變換。
   * 呼叫後即可使用世界座標繪製。
   */
  applyTransform(ctx: CanvasRenderingContext2D): void {
    ctx.translate(this.viewportW / 2, this.viewportH / 2);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.x, -this.y);
  }

  /**
   * 將攝影機移動至指定世界座標中心。
   */
  centerOn(wx: number, wy: number): void {
    this.x = wx;
    this.y = wy;
    this.clamp();
  }

  /**
   * 綁定 Canvas 的滑鼠/觸控事件以支援平移與縮放互動。
   *
   * - 滑鼠拖曳：平移攝影機
   * - 滾輪：縮放
   */
  bindToCanvas(canvas: HTMLCanvasElement): void {
    canvas.addEventListener("mousedown", (e) => {
      if (e.button === 0 || e.button === 2) {
        this.dragging = true;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
        this.camStartX = this.x;
        this.camStartY = this.y;
      }
    });

    canvas.addEventListener("mousemove", (e) => {
      if (!this.dragging) return;
      const dx = (e.clientX - this.dragStartX) / this.zoom;
      const dy = (e.clientY - this.dragStartY) / this.zoom;
      this.x = this.camStartX - dx;
      this.y = this.camStartY - dy;
      this.clamp();
    });

    const stopDrag = () => {
      this.dragging = false;
    };
    canvas.addEventListener("mouseup", stopDrag);
    canvas.addEventListener("mouseleave", stopDrag);

    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * factor));

      // 以滑鼠位置為中心縮放
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const worldBefore = this.screenToWorld(mx, my);

      this.zoom = newZoom;

      // 調整攝影機位置使滑鼠下方的世界座標不變
      const worldAfter = this.screenToWorld(mx, my);
      this.x += worldBefore.x - worldAfter.x;
      this.y += worldBefore.y - worldAfter.y;
      this.clamp();
    }, { passive: false });

    // 禁用右鍵選單（用於拖曳）
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  /** 攝影機是否正在被拖曳中。 */
  get isDragging(): boolean {
    return this.dragging;
  }
}
