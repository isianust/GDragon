import { dispatchArmyFromCity } from "./dispatch.ts";
import { executePillageOnCity } from "./engine/pillage.ts";
import { findDispatchRoutePlan } from "./pathfind.ts";
import { TICKS_PER_MONTH, TICKS_PER_YEAR } from "./gameTime.ts";
import type { Faction, GameState, MapNode, Officer } from "./types.ts";
import type { TickEngine } from "./tickEngine.ts";

function adjacentNodeIds(state: GameState, nodeId: string, revealedHidden: ReadonlySet<string>): string[] {
  const out: string[] = [];
  for (const r of Object.values(state.routes)) {
    if (r.isHidden && !revealedHidden.has(r.id)) continue;
    if (r.sourceNodeId === nodeId) out.push(r.targetNodeId);
    if (r.targetNodeId === nodeId) out.push(r.sourceNodeId);
  }
  return out;
}

function uniqueNodes(nodes: MapNode[]): MapNode[] {
  const seen = new Set<string>();
  const out: MapNode[] = [];
  for (const n of nodes) {
    if (seen.has(n.id)) continue;
    seen.add(n.id);
    out.push(n);
  }
  return out;
}

function pickCommandTeam(
  state: GameState,
  faction: Faction,
  cityId: string,
): { commander: Officer; deputies: Officer[] } | null {
  const pool = Object.values(state.officers)
    .filter(
      (o) =>
        o.ownerId === faction.id &&
        o.status === "IDLE" &&
        o.locationId === cityId &&
        !o.isDead,
    )
    .sort((a, b) => b.stats.martial - a.stats.martial);
  if (pool.length === 0) return null;
  const commander = pool[0]!;
  const deputies = pool.filter((o) => o.id !== commander.id).slice(0, 2);
  return { commander, deputies };
}

/**
 * Opponent macro / tactical AI. Does not bypass fog-of-war route rules (hidden routes need reveal flags).
 */
export class AIEngine {
  runMacro(state: GameState, engine: TickEngine): void {
    if (state.currentTick <= 0) return;
    if (state.currentTick % TICKS_PER_MONTH !== 0) return;

    this.evaluateCoalitionTriggers(state);

    const revealedHiddenRoutes = new Set(state.revealedRouteIds);

    for (const faction of Object.values(state.factions)) {
      if (faction.id === state.playerFactionId) continue;
      if (state.aiSession.lastMacroTickByFaction[faction.id] === state.currentTick) continue;

      if (faction.aiArchetype === "AGGRESSIVE") {
        this.tryAggressiveDispatch(state, engine, faction, revealedHiddenRoutes);
      }

      state.aiSession.lastMacroTickByFaction[faction.id] = state.currentTick;
    }

    this.tryHordeBanditPillage(state, engine);
  }

  private evaluateCoalitionTriggers(state: GameState): void {
    for (const [fid, until] of Object.entries({ ...state.aiSession.coalitionExpiryByFaction })) {
      if (state.currentTick < until) continue;
      const f = state.factions[fid];
      if (f?.allianceId?.startsWith("COALITION_AGAINST_")) {
        f.allianceId = null;
      }
      delete state.aiSession.coalitionExpiryByFaction[fid];
    }

    const totalNodes = Object.keys(state.nodes).length;
    if (totalNodes === 0) return;

    for (const dominant of Object.values(state.factions)) {
      if (dominant.type === "BANDIT" || dominant.type === "HORDE") continue;
      const owned = Object.values(state.nodes).filter((n) => n.ownerId === dominant.id).length;
      if (dominant.globalPrestige <= 80) continue;
      if (owned / totalNodes <= 0.3) continue;

      for (const other of Object.values(state.factions)) {
        if (other.id === dominant.id) continue;
        if (other.type === "BANDIT" || other.type === "HORDE") continue;
        if (other.globalPrestige >= 50) continue;
        other.allianceId = `COALITION_AGAINST_${dominant.id}`;
        state.aiSession.coalitionExpiryByFaction[other.id] = state.currentTick + TICKS_PER_YEAR;
      }
    }
  }

  private tryHordeBanditPillage(state: GameState, engine: TickEngine): void {
    for (const army of Object.values(state.armies)) {
      const fac = state.factions[army.ownerId];
      if (!fac || (fac.type !== "BANDIT" && fac.type !== "HORDE")) continue;
      if (army.status !== "SIEGE") continue;
      const nid = engine.getArmySiegeNodeId(army.id);
      if (!nid) continue;
      const node = state.nodes[nid];
      if (!node || node.type !== "CITY") continue;
      if (Math.random() < 0.35) {
        executePillageOnCity(state, army, node);
      }
    }
  }

  private tryAggressiveDispatch(
    state: GameState,
    engine: TickEngine,
    faction: Faction,
    revealedHiddenRoutes: ReadonlySet<string>,
  ): void {
    if (faction.type === "BANDIT" || faction.type === "HORDE" || faction.type === "PIRATE") {
      return;
    }
    const hasMarching = Object.values(state.armies).some(
      (a) => a.ownerId === faction.id && a.status === "MARCHING",
    );
    if (hasMarching) return;

    const capital = state.nodes[faction.capitalNodeId];
    if (!capital || capital.type !== "CITY") return;

    const enemyCityNodes = Object.values(state.nodes).filter((n) => n.ownerId === faction.id);
    const borderPlayer: MapNode[] = [];
    for (const en of enemyCityNodes) {
      for (const nb of adjacentNodeIds(state, en.id, revealedHiddenRoutes)) {
        const pn = state.nodes[nb];
        if (pn && pn.ownerId === state.playerFactionId) {
          borderPlayer.push(pn);
        }
      }
    }

    const candidates = uniqueNodes(borderPlayer);
    if (candidates.length === 0) return;

    candidates.sort((a, b) => a.resources.troops - b.resources.troops);
    const target = candidates[0]!;
    const team = pickCommandTeam(state, faction, capital.id);
    if (!team) return;

    const plan = findDispatchRoutePlan(
      state,
      capital.id,
      target.id,
      revealedHiddenRoutes,
    );
    if (!plan) return;

    const troopSend = Math.min(4000, Math.max(500, Math.floor(capital.resources.troops * 0.55)));
    const foodSend = Math.min(4000, Math.max(800, Math.floor(capital.resources.food * 0.4)));
    if (troopSend <= 0 || capital.resources.troops < troopSend) return;
    if (foodSend > capital.resources.food) return;

    const armyId = `AI_ARMY_${state.currentTick}_${faction.id}`;

    try {
      dispatchArmyFromCity(state, engine, {
        armyId,
        fromCityId: capital.id,
        commanderId: team.commander.id,
        deputyIds: team.deputies.map((d) => d.id),
        troops: { cavalry: 0, infantry: troopSend, archer: 0 },
        carriedFood: foodSend,
        pathQueue: plan.pathQueue,
        currentRouteId: plan.currentRouteId,
        targetNodeId: target.id,
      });
    } catch {
      /* insufficient resources mid-flight — skip silently */
    }
  }

  /** Reserved for pursuit / retreat micro logic; kept bounded to avoid tick stalls. */
  runTactical(_state: GameState, _engine: TickEngine): void {
    /* no-op: Phase 9 micro behaviors can extend here with strict iteration caps */
  }
}
