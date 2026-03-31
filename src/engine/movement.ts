import type { Army, GameState, Route, Season } from "../types.ts";
import { getTotalTroops } from "./formation.ts";

/** World pacing multiplier; each game tick applies many sub-steps for hour-scale progress. */
export const BASE_WORLD_SPEED_MULTIPLIER = 20;

/** @deprecated Use gameTime.MARCH_FRACTION_PER_TICK — twelve 時辰 per day, one advance per engine tick. */
export const MARCH_SUBSTEPS_PER_DAY = 1;

const SPEED: Record<
  Route["type"],
  { cavalry: number; infantry: number; archer: number }
> = {
  PLAIN: { cavalry: 2.0, infantry: 1.0, archer: 0.8 },
  MOUNTAIN: { cavalry: 0.5, infantry: 1.2, archer: 0.8 },
  WATER: { cavalry: 0.2, infantry: 0.8, archer: 1.5 },
};

export function troopScaleMultiplier(totalTroops: number): number {
  if (totalTroops <= 1000) return 1.5;
  if (totalTroops <= 5000) return 1.0;
  if (totalTroops <= 15000) return 0.7;
  return 0.5;
}

export function weatherAndSeasonSpeedMultiplier(route: Route, season: Season): number {
  let m = 1;
  const w = route.currentWeather;
  if (w === "FOG") m *= 0.8;
  if (w === "RAIN") {
    if (route.type === "PLAIN") m *= 0.6;
    if (route.type === "WATER") m *= 1.2;
  }
  if (w === "SNOW" && route.type === "MOUNTAIN") m *= 0.3;
  if (season === "SUMMER" && route.type === "WATER") m *= 1.2;
  if (season === "WINTER" && route.type === "MOUNTAIN") m *= 0.5;
  return m;
}

/**
 * finalSpeed = baseTerrainSpeed * weatherModifier * scaleModifier * staminaModifier * worldMultiplier
 */
export function computeMarchSpeed(state: GameState, army: Army, route: Route): number {
  const t = army.troops;
  const s = SPEED[route.type];
  const candidates: number[] = [];
  if (t.cavalry > 0) candidates.push(s.cavalry);
  if (t.infantry > 0) candidates.push(s.infantry);
  if (t.archer > 0) candidates.push(s.archer);
  if (candidates.length === 0) return 0;

  let speed = Math.min(...candidates);
  const staminaModifier = army.stamina < 20 ? 0.5 : 1;
  const scaleModifier = troopScaleMultiplier(getTotalTroops(army));
  const wx = weatherAndSeasonSpeedMultiplier(route, state.environment.currentSeason);

  speed *= staminaModifier;
  speed *= scaleModifier;
  speed *= wx;
  speed *= BASE_WORLD_SPEED_MULTIPLIER;
  return speed;
}

export interface MovementTickLog {
  armyId: string;
  routeId: string;
  progressBefore: number;
  progressAfter: number;
  distance: number;
  speedApplied: number;
  arrivedAtNodeId: string | null;
}

export function startNextRouteIfNeeded(army: Army): void {
  if (army.status !== "MARCHING") return;
  if (army.currentRouteId !== null) return;
  if (army.pathQueue.length === 0) return;
  const nextId = army.pathQueue.shift()!;
  army.currentRouteId = nextId;
  army.progress = 0;
}

export function advanceMarchingProgress(
  state: GameState,
  stationByArmy: Map<string, string>,
  logs: MovementTickLog[],
  stepFraction = 1,
): void {
  const frac = Math.min(1, Math.max(0, stepFraction));
  for (const army of Object.values(state.armies)) {
    if (army.status !== "MARCHING") continue;
    if (!army.currentRouteId) continue;
    const route = state.routes[army.currentRouteId];
    if (!route) continue;

    const speed = computeMarchSpeed(state, army, route) * frac;
    const before = army.progress;
    army.progress += speed;

    let arrivedAt: string | null = null;
    if (army.progress >= route.distance) {
      army.lastEnteredFromNodeId = route.sourceNodeId;
      army.progress = 0;
      army.currentRouteId = null;
      arrivedAt = route.targetNodeId;
      stationByArmy.set(army.id, route.targetNodeId);
    }

    logs.push({
      armyId: army.id,
      routeId: route.id,
      progressBefore: before,
      progressAfter: army.currentRouteId ? army.progress : 0,
      distance: route.distance,
      speedApplied: speed,
      arrivedAtNodeId: arrivedAt,
    });
  }
}
