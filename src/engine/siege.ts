import type { Army, GameState, MapNode } from "../types.ts";
import {
  fieldDamagePerTick,
  syncOfficerStatusForArmy,
  totalCombatPower,
} from "./combat.ts";

function cityDefenderTcp(state: GameState, node: MapNode): number {
  const mayorId = node.mayorId;
  const mayor = mayorId ? state.officers[mayorId] : null;
  const commandStat = mayor ? mayor.stats.command : 50;
  return node.resources.troops * 1 * 1 * commandStat;
}

export interface SiegeResolutionLog {
  armyId: string;
  nodeId: string;
  baseDamage: number;
  wallDamage: number;
  garrisonDamage: number;
  defenseAfter: number;
  troopsAfter: number;
}

function siegeDamageChaosFactor(): number {
  return 0.9 + Math.random() * 0.2;
}

export function resolveSiegeStep(
  state: GameState,
  army: Army,
  node: MapNode,
  stationByArmy: Map<string, string>,
  siegeByArmy: Map<string, string>,
  logs: SiegeResolutionLog[],
): void {
  if (army.status !== "SIEGE") return;

  if (node.ownerId === army.ownerId) {
    army.status = "IDLE";
    army.currentRouteId = null;
    army.progress = 0;
    army.pathQueue = [];
    syncOfficerStatusForArmy(state, army, "IDLE");
    stationByArmy.set(army.id, node.id);
    siegeByArmy.delete(army.id);
    return;
  }

  const atkTcp = totalCombatPower(state, army);
  const defTcp = cityDefenderTcp(state, node);
  const base = fieldDamagePerTick(atkTcp, defTcp) * siegeDamageChaosFactor();

  army.stamina = Math.max(0, army.stamina - 0.45);
  army.morale = Math.max(0, army.morale - 0.14);

  const maxD = Math.max(node.maxDefense, 1);
  const reduction = (node.defense / maxD) * 0.8;
  const wallHalf = base * 0.5;
  const garrisonHalf = base * 0.5 * (1 - reduction);

  node.defense = Math.max(0, node.defense - wallHalf);
  node.resources.troops = Math.max(0, node.resources.troops - garrisonHalf);

  logs.push({
    armyId: army.id,
    nodeId: node.id,
    baseDamage: base,
    wallDamage: wallHalf,
    garrisonDamage: garrisonHalf,
    defenseAfter: node.defense,
    troopsAfter: node.resources.troops,
  });

  if (node.resources.troops <= 0) {
    node.ownerId = army.ownerId;
    army.status = "IDLE";
    army.currentRouteId = null;
    army.progress = 0;
    army.pathQueue = [];
    army.combatEngagement = null;
    army.morale = Math.max(0, army.morale - (3 + Math.random() * 6));
    syncOfficerStatusForArmy(state, army, "IDLE");
    stationByArmy.set(army.id, node.id);
    siegeByArmy.delete(army.id);
  }
}
