import type { Army, GameState } from "../types.ts";
import { beginFieldCombatEngagement, syncOfficerStatusForArmy } from "./combat.ts";

export interface CollisionLog {
  armyId: string;
  nodeId: string;
  outcome: "SIEGE" | "COMBAT";
  enemyArmyId?: string;
}

function armiesAtNode(
  state: GameState,
  nodeId: string,
  stationByArmy: Map<string, string>,
): Army[] {
  const out: Army[] = [];
  for (const army of Object.values(state.armies)) {
    const station = stationByArmy.get(army.id);
    if (station === nodeId) out.push(army);
  }
  return out;
}

/**
 * Hostile IDLE armies sharing the same node (garrison clash) enter field combat.
 * Same-faction stacks are allowed without fighting.
 */
export function resolveStationedArmyConflicts(
  state: GameState,
  stationByArmy: Map<string, string>,
  siegeByArmy: Map<string, string>,
  combatByArmy: Map<string, string>,
  logs: CollisionLog[],
): void {
  const byNode = new Map<string, Army[]>();
  for (const army of Object.values(state.armies)) {
    if (army.status !== "IDLE") continue;
    const nid = stationByArmy.get(army.id);
    if (!nid) continue;
    const list = byNode.get(nid) ?? [];
    list.push(army);
    byNode.set(nid, list);
  }

  const paired = new Set<string>();
  for (const [nodeId, armies] of byNode) {
    if (armies.length < 2) continue;
    const owners = new Set(armies.map((a) => a.ownerId));
    if (owners.size < 2) continue;

    const first = armies[0]!;
    const second = armies.find((a) => a.ownerId !== first.ownerId);
    if (!second || paired.has(first.id) || paired.has(second.id)) continue;

    first.status = "COMBAT";
    second.status = "COMBAT";
    syncOfficerStatusForArmy(state, first, "COMBAT");
    syncOfficerStatusForArmy(state, second, "COMBAT");
    combatByArmy.set(first.id, second.id);
    combatByArmy.set(second.id, first.id);
    beginFieldCombatEngagement(first);
    beginFieldCombatEngagement(second);
    siegeByArmy.delete(first.id);
    siegeByArmy.delete(second.id);
    paired.add(first.id);
    paired.add(second.id);
    logs.push({
      armyId: first.id,
      nodeId,
      outcome: "COMBAT",
      enemyArmyId: second.id,
    });
  }
}

export function runCollisionPhase(
  state: GameState,
  arrivals: { armyId: string; nodeId: string }[],
  stationByArmy: Map<string, string>,
  siegeByArmy: Map<string, string>,
  combatByArmy: Map<string, string>,
  logs: CollisionLog[],
): void {
  const processedCombat = new Set<string>();

  for (const { armyId, nodeId } of arrivals) {
    const army = state.armies[armyId];
    if (!army || army.status !== "MARCHING") continue;

    const present = armiesAtNode(state, nodeId, stationByArmy);
    const hostileFieldArmy = present.find(
      (other) =>
        other.id !== army.id &&
        other.ownerId !== army.ownerId &&
        (other.status === "MARCHING" ||
          other.status === "IDLE" ||
          other.status === "COMBAT" ||
          other.status === "SIEGE"),
    );

    if (hostileFieldArmy) {
      if (processedCombat.has(army.id) || processedCombat.has(hostileFieldArmy.id)) continue;
      army.status = "COMBAT";
      hostileFieldArmy.status = "COMBAT";
      syncOfficerStatusForArmy(state, army, "COMBAT");
      syncOfficerStatusForArmy(state, hostileFieldArmy, "COMBAT");
      combatByArmy.set(army.id, hostileFieldArmy.id);
      combatByArmy.set(hostileFieldArmy.id, army.id);
      beginFieldCombatEngagement(army);
      beginFieldCombatEngagement(hostileFieldArmy);
      siegeByArmy.delete(army.id);
      siegeByArmy.delete(hostileFieldArmy.id);
      processedCombat.add(army.id);
      processedCombat.add(hostileFieldArmy.id);
      logs.push({
        armyId: army.id,
        nodeId,
        outcome: "COMBAT",
        enemyArmyId: hostileFieldArmy.id,
      });
      continue;
    }

    const node = state.nodes[nodeId];
    if (!node) continue;
    if (node.ownerId === army.ownerId) {
      if (army.pathQueue.length === 0) {
        army.status = "IDLE";
        syncOfficerStatusForArmy(state, army, "IDLE");
      }
      stationByArmy.set(army.id, nodeId);
      continue;
    }
    army.status = "SIEGE";
    syncOfficerStatusForArmy(state, army, "SIEGE");
    siegeByArmy.set(army.id, nodeId);
    logs.push({ armyId: army.id, nodeId, outcome: "SIEGE" });
  }
}
