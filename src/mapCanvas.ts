import { AssetManager } from "./AssetManager.ts";
import { Camera } from "./camera.ts";
import { commanderDisplayGlyph } from "./commanderGlyph.ts";
import { t } from "./i18n/i18n.ts";
import { NODE_WORLD_POSITIONS, STAGE1_WORLD_BOUNDS } from "./mapLayout.ts";
import type { Army, GameState, MapNode, Route } from "./types.ts";
import type { TickEngine } from "./tickEngine.ts";

const FACTION_FILL: Record<string, string> = {
  FAC_SHU: "#15803d",
  FAC_ENEMY: "#b91c1c",
};

const FACTION_FLAG_ASSET: Record<string, string> = {
  FAC_SHU: "faction-flag-FAC_SHU",
  FAC_ENEMY: "faction-flag-FAC_ENEMY",
};

function factionColor(ownerId: string): string {
  return FACTION_FILL[ownerId] ?? "#64748b";
}

function routeStyle(route: Route): { width: number; color: string } {
  switch (route.type) {
    case "PLAIN":
      return { width: 6, color: "#b45309" };
    case "MOUNTAIN":
      return { width: 3, color: "#713f12" };
    case "WATER":
      return { width: 5, color: "#2563eb" };
  }
}

/** Tower Defense 風格路徑背景色（低透明度的路線底色）。 */
function routePathBg(route: Route): string {
  switch (route.type) {
    case "PLAIN":
      return "rgba(180, 83, 9, 0.12)";
    case "MOUNTAIN":
      return "rgba(113, 63, 18, 0.10)";
    case "WATER":
      return "rgba(37, 99, 235, 0.10)";
  }
}

/** 路線地形圖示文字。 */
function routeTerrainGlyph(route: Route): string {
  switch (route.type) {
    case "PLAIN":
      return "\u{1F3D4}";
    case "MOUNTAIN":
      return "\u26F0";
    case "WATER":
      return "\u{1F30A}";
  }
}

export class MapCanvasRenderer {
  private readonly assets = AssetManager.getInstance();
  private readonly canvas: HTMLCanvasElement;
  private readonly getState: () => GameState;
  private readonly getEngine: () => TickEngine;

  /** 攝影機實例：管理平移與縮放。 */
  readonly camera: Camera;

  /** 動畫偏移量（用於 Tower Defense 行軍路徑虛線動畫）。 */
  private dashOffset = 0;

  constructor(
    canvas: HTMLCanvasElement,
    getState: () => GameState,
    getEngine: () => TickEngine,
  ) {
    this.canvas = canvas;
    this.getState = getState;
    this.getEngine = getEngine;

    this.camera = new Camera();
    this.camera.bounds = { ...STAGE1_WORLD_BOUNDS };
    this.camera.bindToCanvas(canvas);

    // 初始化攝影機至地圖中心
    const cx = (STAGE1_WORLD_BOUNDS.minX + STAGE1_WORLD_BOUNDS.maxX) / 2;
    const cy = (STAGE1_WORLD_BOUNDS.minY + STAGE1_WORLD_BOUNDS.maxY) / 2;
    this.camera.centerOn(cx, cy);
  }

  resizeToDisplaySize(): void {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.floor(rect.width * dpr);
    const h = Math.floor(rect.height * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.camera.setViewport(rect.width, rect.height);
  }

  setCanvasAccessibilityLabel(label: string): void {
    this.canvas.setAttribute("aria-label", label);
  }

  drawFrame(): void {
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;
    const state = this.getState();
    const engine = this.getEngine();
    const dpr = window.devicePixelRatio || 1;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;

    // 清除整個 Canvas（在設備像素空間）
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // 繪製世界背景網格
    ctx.save();
    this.camera.applyTransform(ctx);
    this.drawWorldBackground(ctx);
    ctx.restore();

    // Tower Defense 風格：先繪製路線底色寬帶
    ctx.save();
    this.camera.applyTransform(ctx);
    this.drawRoutePathBands(ctx, state);
    ctx.restore();

    // 繪製路線主線條
    ctx.save();
    this.camera.applyTransform(ctx);
    this.drawRoutes(ctx, state);
    ctx.restore();

    // 繪製行軍中軍隊的虛線動畫路徑
    ctx.save();
    this.camera.applyTransform(ctx);
    this.drawMarchPaths(ctx, state);
    ctx.restore();

    // 繪製節點
    ctx.save();
    this.camera.applyTransform(ctx);
    this.drawNodes(ctx, state);
    ctx.restore();

    // 繪製軍隊標記
    ctx.save();
    this.camera.applyTransform(ctx);
    this.drawArmies(ctx, state, engine);
    ctx.restore();

    // 繪製小地圖（固定在螢幕右下角，不受攝影機影響）
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.drawMinimap(ctx, state, w, h);

    // 更新動畫偏移
    this.dashOffset = (this.dashOffset + 0.5) % 20;
  }

  /** 繪製世界座標系背景網格。 */
  private drawWorldBackground(ctx: CanvasRenderingContext2D): void {
    const b = this.camera.bounds;
    const gridSize = 100;

    // 背景填充
    ctx.fillStyle = "#fafaf9";
    ctx.fillRect(b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY);

    // 網格線
    ctx.strokeStyle = "rgba(148, 163, 184, 0.15)";
    ctx.lineWidth = 1 / this.camera.zoom;

    for (let x = b.minX; x <= b.maxX; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, b.minY);
      ctx.lineTo(x, b.maxY);
      ctx.stroke();
    }
    for (let y = b.minY; y <= b.maxY; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(b.minX, y);
      ctx.lineTo(b.maxX, y);
      ctx.stroke();
    }

    // 世界邊框
    ctx.strokeStyle = "rgba(100, 116, 139, 0.3)";
    ctx.lineWidth = 2 / this.camera.zoom;
    ctx.strokeRect(b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY);
  }

  /**
   * Tower Defense 風格：在路線上繪製寬帶底色，表示固定行軍通道。
   */
  private drawRoutePathBands(ctx: CanvasRenderingContext2D, state: GameState): void {
    const revealed = new Set(state.revealedRouteIds);
    for (const route of Object.values(state.routes)) {
      if (route.isHidden && !revealed.has(route.id)) continue;
      const a = NODE_WORLD_POSITIONS[route.sourceNodeId];
      const b = NODE_WORLD_POSITIONS[route.targetNodeId];
      if (!a || !b) continue;

      const bandWidth = route.type === "PLAIN" ? 36 : route.type === "WATER" ? 30 : 20;
      ctx.save();
      ctx.strokeStyle = routePathBg(route);
      ctx.lineWidth = bandWidth;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.restore();
    }
  }

  /** 繪製路線主線條。 */
  private drawRoutes(ctx: CanvasRenderingContext2D, state: GameState): void {
    const revealed = new Set(state.revealedRouteIds);
    for (const route of Object.values(state.routes)) {
      if (route.isHidden && !revealed.has(route.id)) continue;
      const a = NODE_WORLD_POSITIONS[route.sourceNodeId];
      const b = NODE_WORLD_POSITIONS[route.targetNodeId];
      if (!a || !b) continue;
      const { width, color } = routeStyle(route);
      const tex = this.assets.get(route.textureAssetId ?? null);
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      if (tex) {
        ctx.globalAlpha = 0.35;
        const steps = 12;
        for (let i = 0; i <= steps; i++) {
          const tStep = i / steps;
          const x = a.x + (b.x - a.x) * tStep;
          const y = a.y + (b.y - a.y) * tStep;
          const s = 18;
          ctx.drawImage(tex, x - s / 2, y - s / 2, s, s);
        }
        ctx.globalAlpha = 1;
      }
      ctx.restore();

      // Tower Defense 風格：路線中點標示距離與地形
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      ctx.save();
      ctx.font = "10px system-ui, Roboto, 'Noto Sans TC', sans-serif";
      ctx.fillStyle = "rgba(51, 65, 85, 0.65)";
      ctx.textAlign = "center";
      ctx.fillText(`${routeTerrainGlyph(route)} ${route.distance}`, mx, my - 8);
      if (route.currentWeather !== "CLEAR") {
        const wLabel = route.currentWeather === "RAIN" ? "\u{1F327}" : route.currentWeather === "SNOW" ? "\u2744" : "\u{1F32B}";
        ctx.fillText(wLabel, mx, my + 14);
      }
      ctx.restore();

      // Tower Defense 風格：路線方向箭頭
      this.drawRouteArrow(ctx, a, b, color);
    }
  }

  /** 在路線上繪製方向箭頭。 */
  private drawRouteArrow(
    ctx: CanvasRenderingContext2D,
    from: { x: number; y: number },
    to: { x: number; y: number },
    color: string,
  ): void {
    const mx = (from.x + to.x) / 2;
    const my = (from.y + to.y) / 2;
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const arrowSize = 10;

    ctx.save();
    ctx.translate(mx, my);
    ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(arrowSize, 0);
    ctx.lineTo(-arrowSize * 0.6, -arrowSize * 0.5);
    ctx.lineTo(-arrowSize * 0.6, arrowSize * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /**
   * Tower Defense 風格：為行軍中的軍隊繪製動態虛線路徑。
   */
  private drawMarchPaths(ctx: CanvasRenderingContext2D, state: GameState): void {
    for (const army of Object.values(state.armies)) {
      if (army.status !== "MARCHING") continue;
      if (!army.currentRouteId) continue;
      const route = state.routes[army.currentRouteId];
      if (!route) continue;

      const a = NODE_WORLD_POSITIONS[route.sourceNodeId];
      const b = NODE_WORLD_POSITIONS[route.targetNodeId];
      if (!a || !b) continue;

      const color = factionColor(army.ownerId);
      const progress = Math.min(1, Math.max(0, army.progress / Math.max(route.distance, 1e-6)));

      const cx = a.x + (b.x - a.x) * progress;
      const cy = a.y + (b.y - a.y) * progress;

      // 已走過的路段（實線）
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(cx, cy);
      ctx.stroke();
      ctx.restore();

      // 剩餘路段（動態虛線）
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.35;
      ctx.setLineDash([8, 6]);
      ctx.lineDashOffset = -this.dashOffset;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.restore();

      // 後續路徑佇列
      for (const nextRouteId of army.pathQueue) {
        const nextRoute = state.routes[nextRouteId];
        if (!nextRoute) break;
        const na = NODE_WORLD_POSITIONS[nextRoute.sourceNodeId];
        const nb = NODE_WORLD_POSITIONS[nextRoute.targetNodeId];
        if (!na || !nb) break;

        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.2;
        ctx.setLineDash([4, 8]);
        ctx.lineDashOffset = -this.dashOffset;
        ctx.beginPath();
        ctx.moveTo(na.x, na.y);
        ctx.lineTo(nb.x, nb.y);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  /** 繪製城池與關隘節點。 */
  private drawNodes(ctx: CanvasRenderingContext2D, state: GameState): void {
    for (const node of Object.values(state.nodes)) {
      const pos = NODE_WORLD_POSITIONS[node.id];
      if (!pos) continue;
      this.drawSingleNode(ctx, node, pos.x, pos.y);
    }
  }

  private drawSingleNode(
    ctx: CanvasRenderingContext2D,
    node: MapNode,
    x: number,
    y: number,
  ): void {
    const fill = factionColor(node.ownerId);
    const sprite = this.assets.get(node.spriteAssetId ?? null);
    ctx.save();
    ctx.translate(x, y);
    if (sprite) {
      const size = node.type === "CITY" ? 64 : 56;
      const h = node.type === "GATE" ? size * 1.35 : size;
      ctx.drawImage(sprite, -size / 2, -h / 2, size, h);
    } else if (node.type === "CITY") {
      const flagId = FACTION_FLAG_ASSET[node.ownerId];
      const flagImg = flagId ? this.assets.get(flagId) : null;
      if (flagImg) {
        const fw = 52;
        const fh = 70;
        ctx.drawImage(flagImg, -fw / 2, -fh / 2, fw, fh);
        ctx.strokeStyle = "rgba(15,23,42,0.35)";
        ctx.lineWidth = 2;
        ctx.strokeRect(-fw / 2, -fh / 2, fw, fh);
      } else {
        ctx.shadowColor = fill;
        ctx.shadowBlur = 12;
        ctx.fillStyle = fill;
        this.roundRect(ctx, -28, -28, 56, 56, 8);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "rgba(15,23,42,0.45)";
        ctx.lineWidth = 2;
        this.roundRect(ctx, -28, -28, 56, 56, 8);
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = fill;
      ctx.shadowColor = fill;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(0, -30);
      ctx.lineTo(20, 0);
      ctx.lineTo(0, 30);
      ctx.lineTo(-20, 0);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(15,23,42,0.45)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.font = "600 12px system-ui, Roboto, 'Noto Sans TC', sans-serif";
    ctx.fillStyle = "rgba(15,23,42,0.92)";
    ctx.textAlign = "center";
    const nameDy = node.type === "CITY" ? 48 : 42;
    const troopDy = node.type === "CITY" ? 64 : 58;
    ctx.fillText(node.name, x, y + nameDy);
    ctx.fillStyle = "rgba(51,65,85,0.95)";
    ctx.fillText(
      t("map.nodeTroops", { n: Math.round(node.resources.troops) }),
      x,
      y + troopDy,
    );

    // 城防值指示條
    if (node.type === "CITY" || node.type === "GATE") {
      const barW = 48;
      const barH = 4;
      const ratio = Math.max(0, Math.min(1, node.defense / Math.max(node.maxDefense, 1)));
      ctx.fillStyle = "rgba(100, 116, 139, 0.3)";
      ctx.fillRect(x - barW / 2, y + troopDy + 6, barW, barH);
      ctx.fillStyle = ratio > 0.5 ? "#22c55e" : ratio > 0.2 ? "#eab308" : "#ef4444";
      ctx.fillRect(x - barW / 2, y + troopDy + 6, barW * ratio, barH);
    }
    ctx.restore();
  }

  /** 繪製軍隊標記。 */
  private drawArmies(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    engine: TickEngine,
  ): void {
    const stacks = new Map<string, number>();
    for (const army of Object.values(state.armies)) {
      const p = this.armyWorldPosition(state, engine, army);
      if (!p) continue;
      const key = `${Math.round(p.x)}:${Math.round(p.y)}`;
      const idx = stacks.get(key) ?? 0;
      stacks.set(key, idx + 1);
      const ox = idx * 10;
      const oy = idx * -6;
      this.drawArmyMarker(ctx, state, army, p.x + ox, p.y + oy);
    }
  }

  private armyWorldPosition(
    state: GameState,
    engine: TickEngine,
    army: Army,
  ): { x: number; y: number } | null {
    if (army.status === "MARCHING" && army.currentRouteId) {
      const route = state.routes[army.currentRouteId];
      if (!route) return null;
      const a = NODE_WORLD_POSITIONS[route.sourceNodeId];
      const b = NODE_WORLD_POSITIONS[route.targetNodeId];
      if (!a || !b) return null;
      const t = Math.min(1, Math.max(0, army.progress / Math.max(route.distance, 1e-6)));
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }

    const siegeNode = engine.getArmySiegeNodeId(army.id);
    if (siegeNode) {
      const p = NODE_WORLD_POSITIONS[siegeNode];
      return p ? { ...p } : null;
    }

    const station = engine.getArmyStationNodeId(army.id);
    if (station && state.nodes[station]) {
      const p = NODE_WORLD_POSITIONS[station];
      return p ? { ...p } : null;
    }

    const loc = state.officers[army.commanderId]?.locationId;
    if (loc && state.nodes[loc]) {
      const p = NODE_WORLD_POSITIONS[loc];
      return p ? { ...p } : null;
    }

    return null;
  }

  private drawArmyMarker(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    army: Army,
    x: number,
    y: number,
  ): void {
    const commander = state.officers[army.commanderId];
    const initial = commander ? commanderDisplayGlyph(commander.name) : "?";
    const avatar = this.assets.get(commander?.avatarAssetId ?? commander?.portraitAssetId ?? null);
    const color = factionColor(army.ownerId);

    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.clip();
    if (avatar) {
      ctx.drawImage(avatar, -18, -18, 36, 36);
    } else {
      ctx.fillStyle = color;
      ctx.fillRect(-18, -18, 36, 36);
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.font = "bold 16px system-ui, Roboto, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(initial, 0, 1);
    }
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = "rgba(15,23,42,0.65)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    if (army.status === "COMBAT" || army.status === "SIEGE") {
      ctx.save();
      ctx.strokeStyle = "#d97706";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x - 10, y - 10);
      ctx.lineTo(x + 10, y + 10);
      ctx.moveTo(x + 10, y - 10);
      ctx.lineTo(x - 10, y + 10);
      ctx.stroke();
      ctx.restore();
    }
  }

  /**
   * 繪製小地圖（Minimap）。
   */
  private drawMinimap(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    viewW: number,
    viewH: number,
  ): void {
    const mmW = 160;
    const mmH = 80;
    const mmX = viewW - mmW - 12;
    const mmY = viewH - mmH - 12;
    const b = this.camera.bounds;
    const worldW = b.maxX - b.minX;
    const worldH = b.maxY - b.minY;

    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.fillRect(mmX - 1, mmY - 1, mmW + 2, mmH + 2);
    ctx.strokeStyle = "rgba(148, 163, 184, 0.4)";
    ctx.lineWidth = 1;
    ctx.strokeRect(mmX - 1, mmY - 1, mmW + 2, mmH + 2);
    ctx.globalAlpha = 1;

    const toMmX = (wx: number) => mmX + ((wx - b.minX) / worldW) * mmW;
    const toMmY = (wy: number) => mmY + ((wy - b.minY) / worldH) * mmH;

    const revealed = new Set(state.revealedRouteIds);
    for (const route of Object.values(state.routes)) {
      if (route.isHidden && !revealed.has(route.id)) continue;
      const a = NODE_WORLD_POSITIONS[route.sourceNodeId];
      const bPos = NODE_WORLD_POSITIONS[route.targetNodeId];
      if (!a || !bPos) continue;
      ctx.strokeStyle = "rgba(148, 163, 184, 0.5)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(toMmX(a.x), toMmY(a.y));
      ctx.lineTo(toMmX(bPos.x), toMmY(bPos.y));
      ctx.stroke();
    }

    for (const node of Object.values(state.nodes)) {
      const pos = NODE_WORLD_POSITIONS[node.id];
      if (!pos) continue;
      ctx.fillStyle = factionColor(node.ownerId);
      ctx.fillRect(toMmX(pos.x) - 3, toMmY(pos.y) - 3, 6, 6);
    }

    for (const army of Object.values(state.armies)) {
      const pos = this.armyWorldPosition(state, this.getEngine(), army);
      if (!pos) continue;
      ctx.fillStyle = factionColor(army.ownerId);
      ctx.beginPath();
      ctx.arc(toMmX(pos.x), toMmY(pos.y), 2, 0, Math.PI * 2);
      ctx.fill();
    }

    const cam = this.camera;
    const halfVW = (viewW / cam.zoom) / 2;
    const halfVH = (viewH / cam.zoom) / 2;
    const vx1 = toMmX(cam.x - halfVW);
    const vy1 = toMmY(cam.y - halfVH);
    const vx2 = toMmX(cam.x + halfVW);
    const vy2 = toMmY(cam.y + halfVH);
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(
      Math.max(mmX, vx1),
      Math.max(mmY, vy1),
      Math.min(mmX + mmW, vx2) - Math.max(mmX, vx1),
      Math.min(mmY + mmH, vy2) - Math.max(mmY, vy1),
    );

    ctx.restore();
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  pickNodeAt(clientX: number, clientY: number): MapNode | null {
    const rect = this.canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const world = this.camera.screenToWorld(sx, sy);
    const state = this.getState();
    let best: MapNode | null = null;
    let bestD = Infinity;
    for (const node of Object.values(state.nodes)) {
      const p = NODE_WORLD_POSITIONS[node.id];
      if (!p) continue;
      const halfW = node.type === "CITY" ? 32 : 22;
      const halfH = node.type === "CITY" ? 32 : 32;
      if (
        world.x >= p.x - halfW &&
        world.x <= p.x + halfW &&
        world.y >= p.y - halfH &&
        world.y <= p.y + halfH
      ) {
        const d = (world.x - p.x) ** 2 + (world.y - p.y) ** 2;
        if (d < bestD) {
          bestD = d;
          best = node;
        }
      }
    }
    return best;
  }
}
