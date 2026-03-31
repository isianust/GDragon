import type { Army, GameState, Officer } from "../types.ts";
import { getTotalTroops } from "./formation.ts";

const TCP_FLOOR = 1e-6;

function fallbackRetreatNode(state: GameState, loser: Army, combatNodeId: string): string {
  if (loser.lastEnteredFromNodeId && state.nodes[loser.lastEnteredFromNodeId]) {
    return loser.lastEnteredFromNodeId;
  }
  for (const r of Object.values(state.routes)) {
    if (r.sourceNodeId === combatNodeId && state.nodes[r.targetNodeId]?.ownerId === loser.ownerId) {
      return r.targetNodeId;
    }
    if (r.targetNodeId === combatNodeId && state.nodes[r.sourceNodeId]?.ownerId === loser.ownerId) {
      return r.sourceNodeId;
    }
  }
  for (const r of Object.values(state.routes)) {
    if (r.sourceNodeId === combatNodeId) return r.targetNodeId;
    if (r.targetNodeId === combatNodeId) return r.sourceNodeId;
  }
  return combatNodeId;
}

export function effectiveMartial(state: GameState, army: Army): number {
  const commander = state.officers[army.commanderId];
  if (!commander) return 0;
  let sum = commander.stats.martial;
  for (const deputyId of army.deputyIds) {
    const d = state.officers[deputyId];
    if (d) sum += d.stats.martial * 0.2;
  }
  return sum;
}

function feudMartialBonus(state: GameState, army: Army, enemyFactionId?: string): number {
  if (!enemyFactionId) return 0;
  let bonus = 0;
  const cmd = state.officers[army.commanderId];
  if (cmd?.feudFactionId === enemyFactionId) bonus += 20;
  for (const did of army.deputyIds) {
    if (state.officers[did]?.feudFactionId === enemyFactionId) bonus += 20;
  }
  return bonus;
}

function bondTcpMultiplier(state: GameState, army: Army): number {
  const cmd = state.officers[army.commanderId];
  if (!cmd) return 1;
  for (const did of army.deputyIds) {
    if (cmd.bondIds.includes(did)) return 1.3;
    const d = state.officers[did];
    if (d?.bondIds.includes(army.commanderId)) return 1.3;
  }
  return 1;
}

function moraleOrStaminaFactor(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  return value / 100;
}

export function totalCombatPower(state: GameState, army: Army, enemyFactionId?: string): number {
  const total = getTotalTroops(army);
  const em = effectiveMartial(state, army) + feudMartialBonus(state, army, enemyFactionId);
  let moraleUse = army.morale;
  const cmd = state.officers[army.commanderId];
  if (enemyFactionId && cmd?.feudFactionId === enemyFactionId) {
    moraleUse = Math.max(moraleUse, 100);
  }
  const moraleFactor = moraleOrStaminaFactor(moraleUse);
  const staminaFactor = moraleOrStaminaFactor(army.stamina);
  return total * moraleFactor * staminaFactor * em * bondTcpMultiplier(state, army);
}

export function fieldDamagePerTick(attackerTcp: number, defenderTcp: number): number {
  return (attackerTcp / Math.max(defenderTcp, TCP_FLOOR)) * 100;
}

/** 戰鬥結算 ±10% 波動（同一 tick 雙向傷害共用一個係數）。 */
export function fieldCombatChaosFactor(): number {
  return 0.9 + Math.random() * 0.2;
}

function applyExchangeCombatFatigue(army: Army): void {
  army.stamina = Math.max(0, army.stamina - 0.55);
  army.morale = Math.max(0, army.morale - 0.18);
}

function applyCombatWear(army: Army, troopDamage: number): void {
  if (troopDamage <= 0) return;
  const stress = Math.min(18, troopDamage / 40);
  army.morale = Math.max(0, army.morale - stress * 0.85);
  army.stamina = Math.max(0, army.stamina - stress * 0.65);
}

const TROOP_KEYS = ["cavalry", "infantry", "archer"] as const;

export function distributeTroopLosses(army: Army, rawLoss: number): number {
  const active = TROOP_KEYS.filter((k) => army.troops[k] > 0);
  if (active.length === 0 || rawLoss <= 0) return 0;
  const perType = rawLoss / active.length;
  let applied = 0;
  for (const k of active) {
    const before = army.troops[k];
    army.troops[k] = Math.max(0, before - perType);
    applied += before - army.troops[k];
  }
  return applied;
}

const RETREAT_BFS_MAX_DEPTH = 48;

function findFriendlyRetreatCityNode(
  state: GameState,
  army: Army,
  startNodeId: string,
): string | null {
  const q: string[] = [startNodeId];
  const seen = new Set<string>([startNodeId]);
  const depth = new Map<string, number>([[startNodeId, 0]]);
  let qi = 0;
  while (qi < q.length) {
    const id = q[qi++]!;
    const d = depth.get(id) ?? 0;
    const n = state.nodes[id];
    if (n?.type === "CITY" && n.ownerId === army.ownerId && id !== startNodeId) {
      return id;
    }
    if (d >= RETREAT_BFS_MAX_DEPTH) continue;
    for (const r of Object.values(state.routes)) {
      const next =
        r.sourceNodeId === id ? r.targetNodeId : r.targetNodeId === id ? r.sourceNodeId : null;
      if (!next || seen.has(next)) continue;
      seen.add(next);
      depth.set(next, d + 1);
      q.push(next);
    }
  }
  return null;
}

export function beginFieldCombatEngagement(army: Army): void {
  const n = getTotalTroops(army);
  army.combatEngagement = {
    troopsAtEngagementStart: n,
    retreatAfterCasualties: 800 + Math.floor(Math.random() * 1201),
  };
}

function casualtiesSinceEngagementStart(army: Army): number {
  if (!army.combatEngagement) return 0;
  return army.combatEngagement.troopsAtEngagementStart - getTotalTroops(army);
}

function tryMidBattleRetreat(
  state: GameState,
  runner: Army,
  opponent: Army,
  combatNodeId: string,
  stationByArmy: Map<string, string>,
  combatByArmy: Map<string, string>,
): boolean {
  if (!runner.combatEngagement) return false;
  if (casualtiesSinceEngagementStart(runner) < runner.combatEngagement.retreatAfterCasualties) {
    return false;
  }
  const dest = findFriendlyRetreatCityNode(state, runner, combatNodeId);
  if (!dest) return false;

  runner.combatEngagement = null;
  opponent.combatEngagement = null;
  runner.status = "IDLE";
  syncOfficerStatusForArmy(state, runner, "IDLE");
  stationByArmy.set(runner.id, dest);
  const rc = state.officers[runner.commanderId];
  if (rc) rc.locationId = dest;
  for (const did of runner.deputyIds) {
    const d = state.officers[did];
    if (d) d.locationId = dest;
  }

  opponent.status = "IDLE";
  syncOfficerStatusForArmy(state, opponent, "IDLE");
  stationByArmy.set(opponent.id, combatNodeId);
  const oc = state.officers[opponent.commanderId];
  if (oc) oc.locationId = combatNodeId;
  for (const did of opponent.deputyIds) {
    const d = state.officers[did];
    if (d) d.locationId = combatNodeId;
  }

  combatByArmy.delete(runner.id);
  combatByArmy.delete(opponent.id);
  return true;
}

export function captureChancePercent(victorMartial: number): number {
  return 30 + victorMartial / 2;
}

export interface CombatResolutionLog {
  attackerId: string;
  defenderId: string;
  damageToDefender: number;
  damageToAttacker: number;
}

function applyDefeatToArmy(
  state: GameState,
  victor: Army,
  loser: Army,
  stationByArmy: Map<string, string>,
): void {
  const combatNodeId = stationByArmy.get(loser.id) ?? stationByArmy.get(victor.id);
  if (!combatNodeId) {
    stationByArmy.delete(loser.id);
    delete state.armies[loser.id];
    return;
  }

  victor.combatEngagement = null;
  stationByArmy.set(victor.id, combatNodeId);
  victor.morale = Math.max(0, victor.morale - (3.5 + Math.random() * 5.5));
  victor.stamina = Math.max(0, victor.stamina - (0.8 + Math.random() * 1.2));
  const retreatNode = fallbackRetreatNode(state, loser, combatNodeId);

  const loserCommander = state.officers[loser.commanderId];
  const victorOfficer = state.officers[victor.commanderId];
  const martial = victorOfficer?.stats.martial ?? 0;

  if (loserCommander) {
    const captureBlocked = loserCommander.feudFactionId === victor.ownerId;
    const victorFaction = state.factions[victor.ownerId];
    let capPct = captureChancePercent(martial);
    if (
      victorFaction &&
      victorFaction.edictDuration > 0 &&
      victorFaction.activeEdict === "EDICT_MERITOCRACY"
    ) {
      capPct += 20;
    }
    const p = captureBlocked ? 0 : capPct / 100;
    if (Math.random() < p) {
      loserCommander.status = "CAPTURED";
      loserCommander.ownerId = victor.ownerId;
      loserCommander.locationId = combatNodeId;
    } else {
      loserCommander.status = "IDLE";
      loserCommander.locationId = retreatNode;
    }
  }
  for (const did of loser.deputyIds) {
    const d = state.officers[did];
    if (d) {
      d.status = "IDLE";
      d.locationId = retreatNode;
    }
  }
  stationByArmy.delete(loser.id);
  delete state.armies[loser.id];
}

export function resolveFieldCombatStep(
  state: GameState,
  attackerId: string,
  defenderId: string,
  stationByArmy: Map<string, string>,
  combatByArmy: Map<string, string>,
  logs: CombatResolutionLog[],
): void {
  const a = state.armies[attackerId];
  const b = state.armies[defenderId];
  if (!a || !b) return;
  if (a.status !== "COMBAT" || b.status !== "COMBAT") return;

  const tcpA = totalCombatPower(state, a, b.ownerId);
  const tcpB = totalCombatPower(state, b, a.ownerId);
  const chaos = fieldCombatChaosFactor();
  const dmgAtoB = fieldDamagePerTick(tcpA, tcpB) * chaos;
  const dmgBtoA = fieldDamagePerTick(tcpB, tcpA) * chaos;

  distributeTroopLosses(b, dmgAtoB);
  distributeTroopLosses(a, dmgBtoA);
  applyCombatWear(b, dmgAtoB);
  applyCombatWear(a, dmgBtoA);
  applyExchangeCombatFatigue(a);
  applyExchangeCombatFatigue(b);

  logs.push({
    attackerId: a.id,
    defenderId: b.id,
    damageToDefender: dmgAtoB,
    damageToAttacker: dmgBtoA,
  });

  const troopsA = getTotalTroops(a);
  const troopsB = getTotalTroops(b);

  if (troopsA <= 0 && troopsB <= 0) {
    a.combatEngagement = null;
    b.combatEngagement = null;
    stationByArmy.delete(attackerId);
    stationByArmy.delete(defenderId);
    combatByArmy.delete(attackerId);
    combatByArmy.delete(defenderId);
    delete state.armies[attackerId];
    delete state.armies[defenderId];
    return;
  }

  const combatNodeId = stationByArmy.get(a.id) ?? stationByArmy.get(b.id) ?? "";
  if (combatNodeId && troopsA > 0 && troopsB > 0) {
    if (tryMidBattleRetreat(state, a, b, combatNodeId, stationByArmy, combatByArmy)) return;
    if (tryMidBattleRetreat(state, b, a, combatNodeId, stationByArmy, combatByArmy)) return;
  }

  if (troopsB <= 0) {
    applyDefeatToArmy(state, a, b, stationByArmy);
    a.status = "IDLE";
    syncOfficerStatusForArmy(state, a, "IDLE");
    return;
  }
  if (troopsA <= 0) {
    applyDefeatToArmy(state, b, a, stationByArmy);
    b.status = "IDLE";
    syncOfficerStatusForArmy(state, b, "IDLE");
  }
}

export function syncOfficerStatusForArmy(
  state: GameState,
  army: Army,
  status: Officer["status"],
): void {
  const cmd = state.officers[army.commanderId];
  if (cmd) cmd.status = status;
  for (const did of army.deputyIds) {
    const d = state.officers[did];
    if (d) d.status = status;
  }
}
