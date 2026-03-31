import type { Army, GameState } from "../types.ts";
import {
  seasonFoodDrainMultiplier,
  seasonMarchStaminaExtraDrain,
  seasonWinterFreezeMoralePenalty,
} from "../EnvironmentEngine.ts";
import { TICKS_PER_CALENDAR_DAY } from "../gameTime.ts";
import { getFoodDrainPerTick, getTotalTroops } from "./formation.ts";

export interface LogisticsTickLog {
  armyId: string;
  foodDrain: number;
  carriedFoodAfter: number;
  starvationApplied: boolean;
  staminaAfter: number;
  moraleAfter: number;
}

function disbandArmy(state: GameState, armyId: string): void {
  const army = state.armies[armyId];
  if (!army) return;
  for (const oid of [army.commanderId, ...army.deputyIds]) {
    const o = state.officers[oid];
    if (o) o.status = "IDLE";
  }
  delete state.armies[armyId];
}

export function applyLogisticsForArmy(
  state: GameState,
  army: Army,
  logs: LogisticsTickLog[],
): void {
  if (army.status !== "MARCHING" && army.status !== "SIEGE" && army.status !== "COMBAT") {
    return;
  }

  let drain = getFoodDrainPerTick(army);
  drain /= TICKS_PER_CALENDAR_DAY;
  const faction = state.factions[army.ownerId];
  if (
    army.status === "MARCHING" &&
    faction &&
    faction.edictDuration > 0 &&
    faction.activeEdict === "EDICT_TUNTIAN"
  ) {
    drain *= 0.5;
  }
  drain *= seasonFoodDrainMultiplier(state);
  army.carriedFood -= drain;
  let starvation = false;
  if (army.carriedFood <= 0) {
    army.carriedFood = 0;
    army.stamina -= 1.0 / TICKS_PER_CALENDAR_DAY;
    army.morale -= 2.0 / TICKS_PER_CALENDAR_DAY;
    starvation = true;
  }

  if (army.status === "MARCHING") {
    army.stamina -= 0.1 / TICKS_PER_CALENDAR_DAY;
    army.stamina -= seasonMarchStaminaExtraDrain(state) / TICKS_PER_CALENDAR_DAY;
    const freeze = seasonWinterFreezeMoralePenalty(state, army.carriedFood, true);
    if (freeze > 0) {
      army.morale -= freeze / TICKS_PER_CALENDAR_DAY;
    }
  }

  if (state.environment.currentSeason === "SPRING") {
    army.morale = Math.min(100, army.morale + 1 / TICKS_PER_CALENDAR_DAY);
  }

  army.stamina = Math.max(0, army.stamina);
  army.morale = Math.max(0, army.morale);

  if (army.morale <= 0) {
    disbandArmy(state, army.id);
    return;
  }

  logs.push({
    armyId: army.id,
    foodDrain: drain,
    carriedFoodAfter: army.carriedFood,
    starvationApplied: starvation,
    staminaAfter: army.stamina,
    moraleAfter: army.morale,
  });
}

export function applyLogisticsPhase(state: GameState, logs: LogisticsTickLog[]): void {
  for (const army of Object.values(state.armies)) {
    applyLogisticsForArmy(state, army, logs);
  }
}

export { getTotalTroops };
