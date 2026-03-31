import type { GameState, RouteWeather, Season } from "./types.ts";
import { seasonFromGameTick } from "./gameTime.ts";

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function pickWeatherForSeason(season: Season): RouteWeather {
  const r = Math.random();
  if (season === "WINTER") {
    if (r < 0.45) return "SNOW";
    if (r < 0.65) return "FOG";
    if (r < 0.85) return "CLEAR";
    return "RAIN";
  }
  if (season === "SPRING" || season === "SUMMER") {
    if (r < 0.35) return "RAIN";
    if (r < 0.55) return "FOG";
    return "CLEAR";
  }
  if (r < 0.25) return "FOG";
  if (r < 0.4) return "RAIN";
  return "CLEAR";
}

function shufflePick<T>(items: T[], count: number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy.slice(0, Math.min(count, copy.length));
}

/**
 * Global seasons (360-day cycle) and per-route weather (refresh every 10 ticks).
 */
export class EnvironmentEngine {
  applyTick(state: GameState): void {
    state.environment.currentSeason = seasonFromGameTick(state.currentTick);

    for (const route of Object.values(state.routes)) {
      if (route.weatherDuration > 0) {
        route.weatherDuration -= 1;
        if (route.weatherDuration <= 0) {
          route.currentWeather = "CLEAR";
          route.weatherDuration = 0;
        }
      }
    }

    if (state.currentTick % 10 !== 0) return;

    const list = Object.values(state.routes);
    if (list.length === 0) return;
    const pct = 0.1 + Math.random() * 0.1;
    const pickCount = Math.max(1, Math.floor(list.length * pct));
    const season = state.environment.currentSeason;

    for (const route of shufflePick(list, pickCount)) {
      let weather = pickWeatherForSeason(season);
      if (weather === "SNOW" && season !== "WINTER") {
        weather = "CLEAR";
      }
      route.currentWeather = weather;
      route.weatherDuration = randomInt(5, 15);
    }
  }
}

export function seasonFoodDrainMultiplier(state: GameState): number {
  return state.environment.currentSeason === "SUMMER" ? 1.2 : 1;
}

export function seasonMarchStaminaExtraDrain(state: GameState): number {
  if (state.environment.currentSeason !== "WINTER") return 0;
  return 0.1;
}

export function seasonWinterFreezeMoralePenalty(
  state: GameState,
  carriedFood: number,
  isMarching: boolean,
): number {
  if (state.environment.currentSeason !== "WINTER" || !isMarching) return 0;
  if (carriedFood >= 20) return 0;
  return 3;
}
