import type { Army } from "../types.ts";

export function getTotalTroops(army: Army): number {
  return army.troops.cavalry + army.troops.infantry + army.troops.archer;
}

export function getMaxTroopsForArmy(deputyCount: number): number {
  return 5000 * (1 + deputyCount);
}

export function getFoodDrainPerTick(army: Army): number {
  return getTotalTroops(army) * 0.01;
}
