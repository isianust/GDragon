import { AssetManager } from "./AssetManager.ts";
import { commanderDisplayGlyph } from "./commanderGlyph.ts";
import { t } from "./i18n/i18n.ts";
import { NODE_SCREEN_POSITIONS } from "./mapLayout.ts";
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

export class MapCanvasRenderer {
  private readonly assets = AssetManager.getInstance();
  private readonly canvas: HTMLCanvasElement;
  private readonly getState: () => GameState;
  private readonly getEngine: () => TickEngine;

  constructor(
    canvas: HTMLCanvasElement,
    getState: () => GameState,
    getEngine: () => TickEngine,
  ) {
    this.canvas = canvas;
    this.getState = getState;
    this.getEngine = getEngine;
  }

  resizeToDisplaySize(): void {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.floor(rect.width * dpr);
    this.canvas.height = Math.floor(rect.height * dpr);
    const ctx = this.canvas.getContext("2d");
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  setCanvasAccessibilityLabel(label: string): void {
    this.canvas.setAttribute("aria-label", label);
  }

  drawFrame(): void {
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;
    const state = this.getState();
    const engine = this.getEngine();
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;

    ctx.clearRect(0, 0, w, h);

    this.drawRoutes(ctx, state);
    this.drawNodes(ctx, state);
    this.drawArmies(ctx, state, engine);
  }

  private drawRoutes(ctx: CanvasRenderingContext2D, state: GameState): void {
    const revealed = new Set(state.revealedRouteIds);
    for (const route of Object.values(state.routes)) {
      if (route.isHidden && !revealed.has(route.id)) continue;
      const a = NODE_SCREEN_POSITIONS[route.sourceNodeId];
      const b = NODE_SCREEN_POSITIONS[route.targetNodeId];
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
    }
  }

  private drawNodes(ctx: CanvasRenderingContext2D, state: GameState): void {
    for (const node of Object.values(state.nodes)) {
      const pos = NODE_SCREEN_POSITIONS[node.id];
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
        ctx.fillStyle = fill;
        ctx.fillRect(-28, -28, 56, 56);
        ctx.strokeStyle = "rgba(15,23,42,0.45)";
        ctx.lineWidth = 2;
        ctx.strokeRect(-28, -28, 56, 56);
      }
    } else {
      const gw = 24;
      const gh = 62;
      ctx.fillStyle = fill;
      ctx.fillRect(-gw / 2, -gh / 2, gw, gh);
      ctx.strokeStyle = "rgba(15,23,42,0.45)";
      ctx.lineWidth = 2;
      ctx.strokeRect(-gw / 2, -gh / 2, gw, gh);
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
    ctx.restore();
  }

  private drawArmies(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    engine: TickEngine,
  ): void {
    const stacks = new Map<string, number>();
    for (const army of Object.values(state.armies)) {
      const p = this.armyScreenPosition(state, engine, army);
      if (!p) continue;
      const key = `${Math.round(p.x)}:${Math.round(p.y)}`;
      const idx = stacks.get(key) ?? 0;
      stacks.set(key, idx + 1);
      const ox = idx * 10;
      const oy = idx * -6;
      this.drawArmyMarker(ctx, state, army, p.x + ox, p.y + oy);
    }
  }

  private armyScreenPosition(
    state: GameState,
    engine: TickEngine,
    army: Army,
  ): { x: number; y: number } | null {
    if (army.status === "MARCHING" && army.currentRouteId) {
      const route = state.routes[army.currentRouteId];
      if (!route) return null;
      const a = NODE_SCREEN_POSITIONS[route.sourceNodeId];
      const b = NODE_SCREEN_POSITIONS[route.targetNodeId];
      if (!a || !b) return null;
      const t = Math.min(1, Math.max(0, army.progress / Math.max(route.distance, 1e-6)));
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }

    const siegeNode = engine.getArmySiegeNodeId(army.id);
    if (siegeNode) {
      const p = NODE_SCREEN_POSITIONS[siegeNode];
      return p ? { ...p } : null;
    }

    const station = engine.getArmyStationNodeId(army.id);
    if (station && state.nodes[station]) {
      const p = NODE_SCREEN_POSITIONS[station];
      return p ? { ...p } : null;
    }

    const loc = state.officers[army.commanderId]?.locationId;
    if (loc && state.nodes[loc]) {
      const p = NODE_SCREEN_POSITIONS[loc];
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

  pickNodeAt(clientX: number, clientY: number): MapNode | null {
    const rect = this.canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const state = this.getState();
    let best: MapNode | null = null;
    let bestD = Infinity;
    for (const node of Object.values(state.nodes)) {
      const p = NODE_SCREEN_POSITIONS[node.id];
      if (!p) continue;
      const halfW = node.type === "CITY" ? 32 : 14;
      const halfH = node.type === "CITY" ? 32 : 36;
      if (x >= p.x - halfW && x <= p.x + halfW && y >= p.y - halfH && y <= p.y + halfH) {
        const d = (x - p.x) ** 2 + (y - p.y) ** 2;
        if (d < bestD) {
          bestD = d;
          best = node;
        }
      }
    }
    return best;
  }
}
