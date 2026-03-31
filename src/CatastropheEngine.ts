import { TICKS_PER_CALENDAR_DAY } from "./gameTime.ts";
import type { GameState, MapNode } from "./types.ts";

/**
 * Yearly disaster rolls (Phase 12). Bounded work per call — no tight loops over ticks.
 */
export class CatastropheEngine {
  applyYearly(state: GameState): void {
    const cities = Object.values(state.nodes).filter((n) => n.type === "CITY");
    if (cities.length === 0) return;
    const branch = Math.floor(Math.random() * 3);
    if (branch === 0) this.locustSwarm(state, cities);
    else if (branch === 1) this.plagueOutbreak(state, cities);
    else this.terrainCalamity(state);
  }

  private locustSwarm(state: GameState, cities: MapNode[]): void {
    const city = cities[Math.floor(Math.random() * cities.length)]!;
    city.resources.food = 0;
    city.population = Math.floor(city.population * 0.9);
    for (const r of Object.values(state.routes)) {
      if (r.sourceNodeId !== city.id && r.targetNodeId !== city.id) continue;
      const otherId = r.sourceNodeId === city.id ? r.targetNodeId : r.sourceNodeId;
      const n = state.nodes[otherId];
      if (n) n.resources.food = 0;
    }
  }

  private plagueOutbreak(_state: GameState, cities: MapNode[]): void {
    const city = cities[Math.floor(Math.random() * cities.length)]!;
    city.isPlagued = true;
    city.plagueTicksRemaining = 90 * TICKS_PER_CALENDAR_DAY;
  }

  private terrainCalamity(state: GameState): void {
    const routes = Object.values(state.routes).filter(
      (r) => r.type === "MOUNTAIN" || r.type === "WATER",
    );
    if (routes.length === 0) return;
    const route = routes[Math.floor(Math.random() * routes.length)]!;
    const a = state.nodes[route.sourceNodeId];
    const b = state.nodes[route.targetNodeId];
    if (a) a.defense = 0;
    if (b) b.defense = 0;
    for (const army of Object.values(state.armies)) {
      if (army.status !== "MARCHING") continue;
      if (army.currentRouteId !== route.id) continue;
      delete state.armies[army.id];
    }
  }
}
