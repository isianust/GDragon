import { totalCombatPower } from "./engine/combat.ts";
import { getTotalTroops } from "./engine/formation.ts";
import type { Army, GameState, Officer, OfficerStatus } from "./types.ts";

export function findArmyContainingOfficer(state: GameState, officerId: string): Army | null {
  for (const a of Object.values(state.armies)) {
    if (a.commanderId === officerId || a.deputyIds.includes(officerId)) return a;
  }
  return null;
}

/** Troops / morale / stamina from led army, or city garrison when idle on a node. */
export function formatOfficerMilitaryLine(state: GameState, o: Officer): {
  troops: string;
  morale: string;
  stamina: string;
} {
  const army = findArmyContainingOfficer(state, o.id);
  if (army) {
    return {
      troops: String(Math.round(getTotalTroops(army))),
      morale: String(Math.round(army.morale)),
      stamina: String(Math.round(army.stamina)),
    };
  }
  const node = state.nodes[o.locationId];
  if (node) {
    return {
      troops: String(Math.round(node.resources.troops)),
      morale: "—",
      stamina: "—",
    };
  }
  return { troops: "—", morale: "—", stamina: "—" };
}

export type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

export function formatOfficerCourtRole(o: Officer, state: GameState, t: TranslateFn): string {
  const f = state.factions[o.ownerId];
  if (f && f.rulerId === o.id) return t("roster.rankLord");
  return t("roster.rankGeneral");
}

/** Combat power (TCP) when leading an army; rough garrison leverage when idle on a node. */
export function formatOfficerCombatPowerDisplay(state: GameState, o: Officer): string {
  const army = findArmyContainingOfficer(state, o.id);
  if (army) return String(Math.round(totalCombatPower(state, army)));
  const node = state.nodes[o.locationId];
  if (node && o.status === "IDLE") {
    const w = o.stats.command * 0.45 + o.stats.martial * 0.55;
    const approx = (node.resources.troops / 120) * w;
    return String(Math.round(approx));
  }
  return "—";
}

export function formatRosterStatus(status: OfficerStatus, t: TranslateFn): string {
  const key = `status.bilingual.${status}`;
  const s = t(key);
  return s === key ? status : s;
}

export function formatRosterLocation(state: GameState, o: Officer, t: TranslateFn): string {
  const army = findArmyContainingOfficer(state, o.id);
  if (army?.status === "MARCHING" && army.targetNodeId) {
    const dest = state.nodes[army.targetNodeId];
    const name = dest?.name ?? army.targetNodeId;
    return t("roster.marchingDestLine", { dest: name });
  }

  const locationId = o.locationId;
  if (state.routes[locationId]) {
    const key = `route.bilingual.${locationId}`;
    const s = t(key);
    if (s !== key) return s;
  }
  const node = state.nodes[locationId];
  return node?.name ?? locationId;
}
