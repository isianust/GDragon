import type { ActiveEdict, Faction, GameState, MapNode } from "../types.ts";

function mayorPolitics(state: GameState, node: MapNode): number {
  if (!node.mayorId) return 25;
  return state.officers[node.mayorId]?.stats.politics ?? 25;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function factionForNode(state: GameState, node: MapNode): Faction | undefined {
  return state.factions[node.ownerId];
}

function isEdictActive(faction: Faction | undefined, edict: ActiveEdict): boolean {
  return Boolean(faction && faction.edictDuration > 0 && faction.activeEdict === edict);
}

export interface EconomyTickLog {
  nodeId: string;
  policy: MapNode["policy"];
  goldDelta: number;
  foodDelta: number;
  troopsDelta: number;
}

/** Hooks for side effects that must stay in sync with TickEngine registries. */
export interface EconomyEngineHooks {
  registerSiege(armyId: string, nodeId: string): void;
  clearArmyStation(armyId: string): void;
}

export interface MonthlyCivicOptions {
  /** Return value in [0, 1); riot procs if &lt; 0.5 when starvation + low order. */
  riotRoll?: () => number;
}

function applyEmperorPrestige(state: GameState): void {
  for (const node of Object.values(state.nodes)) {
    if (!node.hasEmperor) continue;
    const f = state.factions[node.ownerId];
    if (f) f.globalPrestige = Math.min(200, f.globalPrestige + 5);
  }
}

function spawnBanditRiot(
  state: GameState,
  nodeId: string,
  tick: number,
  hooks: EconomyEngineHooks,
): void {
  const fid = `FAC_RIOT_${nodeId}_${tick}`;
  const oid = `OFC_RIOT_${nodeId}_${tick}`;
  const aid = `ARMY_RIOT_${nodeId}_${tick}`;

  state.factions[fid] = {
    id: fid,
    name: "Riot Bandits",
    rulerId: oid,
    capitalNodeId: nodeId,
    aiArchetype: "AGGRESSIVE",
    globalPrestige: 12,
    type: "BANDIT",
    allianceId: null,
    isRebel: true,
    activeEdict: "NONE",
    edictDuration: 0,
  };

  state.officers[oid] = {
    id: oid,
    name: "Riot Leader",
    stats: { command: 55, martial: 72, intel: 35, politics: 20, luck: 45 },
    trait: "TRAIT_FIERCE",
    status: "SIEGE",
    locationId: nodeId,
    ownerId: fid,
    loyalty: 40,
    ambition: 85,
    bondIds: [],
    feudFactionId: null,
  };

  state.armies[aid] = {
    id: aid,
    ownerId: fid,
    commanderId: oid,
    deputyIds: [],
    carriedFood: 400,
    troops: { cavalry: 0, infantry: 2600, archer: 0 },
    morale: 88,
    stamina: 100,
    status: "SIEGE",
    pathQueue: [],
    currentRouteId: null,
    progress: 0,
    targetNodeId: nodeId,
    lastEnteredFromNodeId: null,
    combatEngagement: null,
  };

  hooks.clearArmyStation(aid);
  hooks.registerSiege(aid, nodeId);
}

/**
 * Public order, starvation, riots, emperor prestige — run once per monthly tick.
 */
export function applyMonthlyCivicEcosystem(
  state: GameState,
  hooks: EconomyEngineHooks,
  opts?: MonthlyCivicOptions,
): void {
  const roll = opts?.riotRoll ?? Math.random;
  applyEmperorPrestige(state);

  for (const node of Object.values(state.nodes)) {
    const drift = (50 - node.publicOrder) * 0.06;
    node.publicOrder = clamp(node.publicOrder + drift, 0, 100);

    if (node.type === "CITY" && node.policy === "POLICY_RESTORE_ORDER") {
      const cost = 450;
      if (node.resources.gold >= cost) {
        node.resources.gold -= cost;
        node.publicOrder = clamp(node.publicOrder + 6, 0, 100);
      }
    }

    const owner = factionForNode(state, node);
    const foodEmpty = node.resources.food <= 0;
    if (foodEmpty) {
      node.resources.troops = Math.floor(node.resources.troops * 0.8);
      const meritPause = isEdictActive(owner, "EDICT_MERITOCRACY");
      if (!meritPause) {
        for (const o of Object.values(state.officers)) {
          if (o.locationId === node.id && o.status === "IDLE") {
            o.loyalty = clamp(o.loyalty - 10, 0, 100);
          }
        }
      }
    }

    if (
      node.type === "CITY" &&
      foodEmpty &&
      node.publicOrder < 20 &&
      roll() < 0.5
    ) {
      node.resources.gold *= 0.5;
      node.defense = Math.max(0, node.defense - 200);
      spawnBanditRiot(state, node.id, state.currentTick, hooks);
      console.log("Riot triggered: Bandit faction spawned");
    }
  }
}

export function applyCityProduction(state: GameState, logs: EconomyTickLog[]): void {
  for (const node of Object.values(state.nodes)) {
    if (node.type !== "CITY") continue;
    const politics = mayorPolitics(state, node);
    const factor = politics / 50;
    let goldDelta = 0;
    let foodDelta = 0;
    let troopsDelta = 0;

    const owner = factionForNode(state, node);
    const conscriptFoodPenalty = isEdictActive(owner, "EDICT_CONSCRIPTION");

    switch (node.policy) {
      case "POLICY_FOCUS_GOLD":
        goldDelta = 1000 * factor;
        break;
      case "POLICY_FOCUS_FOOD":
        foodDelta = 2000 * factor;
        if (state.environment.currentSeason === "AUTUMN") {
          foodDelta *= 1.5;
        }
        if (conscriptFoodPenalty) {
          foodDelta *= 0.7;
        }
        break;
      case "POLICY_FOCUS_DRAFT":
        troopsDelta = 500 * factor;
        if (isEdictActive(owner, "EDICT_CONSCRIPTION")) {
          troopsDelta *= 2;
        }
        break;
      case "POLICY_BALANCED":
        break;
      case "POLICY_RESTORE_ORDER":
        break;
      default:
        break;
    }

    node.resources.gold += goldDelta;
    node.resources.food += foodDelta;
    node.resources.troops += troopsDelta;

    if (goldDelta !== 0 || foodDelta !== 0 || troopsDelta !== 0) {
      logs.push({
        nodeId: node.id,
        policy: node.policy,
        goldDelta,
        foodDelta,
        troopsDelta,
      });
    }
  }
}

/** Full monthly economy pass: civic (order / starvation / riots) then production. */
export function runMonthlyEconomyPhase(
  state: GameState,
  hooks: EconomyEngineHooks,
  economyLogs: EconomyTickLog[],
  opts?: MonthlyCivicOptions,
): void {
  applyMonthlyCivicEcosystem(state, hooks, opts);
  for (const f of Object.values(state.factions)) {
    if (f.edictDuration > 0) {
      f.edictDuration = Math.max(0, f.edictDuration - 30);
    }
  }
  applyCityProduction(state, economyLogs);
}
