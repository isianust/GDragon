import { AIEngine } from "./AIEngine.ts";
import { CatastropheEngine } from "./CatastropheEngine.ts";
import { EnvironmentEngine } from "./EnvironmentEngine.ts";
import { FogOfWarEngine } from "./FogOfWarEngine.ts";
import type { Army, GameState } from "./types.ts";
import {
  resolveStationedArmyConflicts,
  runCollisionPhase,
  type CollisionLog,
} from "./engine/collision.ts";
import {
  resolveFieldCombatStep,
  type CombatResolutionLog,
} from "./engine/combat.ts";
import {
  type EconomyEngineHooks,
  runMonthlyEconomyPhase,
  type EconomyTickLog,
} from "./engine/economy.ts";
import {
  applyLogisticsPhase,
  type LogisticsTickLog,
} from "./engine/logistics.ts";
import {
  MARCH_FRACTION_PER_TICK,
  TICKS_PER_CALENDAR_DAY,
  TICKS_PER_MONTH,
  TICKS_PER_YEAR,
} from "./gameTime.ts";
import {
  advanceMarchingProgress,
  startNextRouteIfNeeded,
  type MovementTickLog,
} from "./engine/movement.ts";
import { resolveSiegeStep, type SiegeResolutionLog } from "./engine/siege.ts";

export interface EngineRegistrySnapshot {
  stations: Record<string, string>;
  sieges: Record<string, string>;
  combats: Record<string, string>;
}

export interface TickResult {
  tick: number;
  logistics: LogisticsTickLog[];
  movement: MovementTickLog[];
  collisions: CollisionLog[];
  combat: CombatResolutionLog[];
  siege: SiegeResolutionLog[];
  economy: EconomyTickLog[];
  stateTransitions: { armyId: string; from: Army["status"]; to: Army["status"]; note?: string }[];
}

export class TickEngine {
  private readonly stationByArmy = new Map<string, string>();
  private readonly siegeByArmy = new Map<string, string>();
  private readonly combatByArmy = new Map<string, string>();
  private readonly environmentEngine = new EnvironmentEngine();
  private readonly fogEngine = new FogOfWarEngine();
  private readonly aiEngine = new AIEngine();
  private readonly catastropheEngine = new CatastropheEngine();

  setArmyStation(armyId: string, nodeId: string): void {
    this.stationByArmy.set(armyId, nodeId);
  }

  pruneRegistries(state: GameState): void {
    for (const id of [...this.siegeByArmy.keys()]) {
      if (!state.armies[id]) this.siegeByArmy.delete(id);
    }
    for (const id of [...this.combatByArmy.keys()]) {
      if (!state.armies[id]) this.combatByArmy.delete(id);
    }
    for (const id of [...this.stationByArmy.keys()]) {
      if (!state.armies[id]) this.stationByArmy.delete(id);
    }
  }

  private syncOfficerLocations(state: GameState): void {
    for (const army of Object.values(state.armies)) {
      if (army.status === "MARCHING" && army.currentRouteId) {
        for (const oid of [army.commanderId, ...army.deputyIds]) {
          const o = state.officers[oid];
          if (o) o.locationId = army.currentRouteId;
        }
        continue;
      }
      if (army.status === "SIEGE") {
        const nid = this.siegeByArmy.get(army.id);
        if (nid) {
          for (const oid of [army.commanderId, ...army.deputyIds]) {
            const o = state.officers[oid];
            if (o) o.locationId = nid;
          }
        }
        continue;
      }
      const station = this.stationByArmy.get(army.id);
      if (station) {
        for (const oid of [army.commanderId, ...army.deputyIds]) {
          const o = state.officers[oid];
          if (o) o.locationId = station;
        }
      }
    }
  }

  private pruneCombatLinks(state: GameState): void {
    for (const id of [...this.combatByArmy.keys()]) {
      const other = this.combatByArmy.get(id);
      if (!other) {
        this.combatByArmy.delete(id);
        continue;
      }
      const a = state.armies[id];
      const b = state.armies[other];
      if (!a || !b || a.status !== "COMBAT" || b.status !== "COMBAT") {
        this.combatByArmy.delete(id);
        this.combatByArmy.delete(other);
      }
    }
  }

  captureRegistrySnapshot(): EngineRegistrySnapshot {
    return {
      stations: Object.fromEntries(this.stationByArmy),
      sieges: Object.fromEntries(this.siegeByArmy),
      combats: Object.fromEntries(this.combatByArmy),
    };
  }

  restoreRegistrySnapshot(snapshot: EngineRegistrySnapshot): void {
    this.stationByArmy.clear();
    this.siegeByArmy.clear();
    this.combatByArmy.clear();
    for (const [k, v] of Object.entries(snapshot.stations)) {
      this.stationByArmy.set(k, v);
    }
    for (const [k, v] of Object.entries(snapshot.sieges)) {
      this.siegeByArmy.set(k, v);
    }
    for (const [k, v] of Object.entries(snapshot.combats)) {
      this.combatByArmy.set(k, v);
    }
  }

  getArmyStationNodeId(armyId: string): string | undefined {
    return this.stationByArmy.get(armyId);
  }

  getArmySiegeNodeId(armyId: string): string | undefined {
    return this.siegeByArmy.get(armyId);
  }

  createEconomyHooks(): EconomyEngineHooks {
    return {
      registerSiege: (armyId, nodeId) => {
        this.siegeByArmy.set(armyId, nodeId);
        this.stationByArmy.delete(armyId);
      },
      clearArmyStation: (armyId) => {
        this.stationByArmy.delete(armyId);
      },
    };
  }

  tick(state: GameState): TickResult {
    state.currentTick += 1;
    const logisticsLogs: LogisticsTickLog[] = [];
    const movementLogs: MovementTickLog[] = [];
    const collisionLogs: CollisionLog[] = [];
    const combatLogs: CombatResolutionLog[] = [];
    const siegeLogs: SiegeResolutionLog[] = [];
    const economyLogs: EconomyTickLog[] = [];
    const stateTransitions: TickResult["stateTransitions"] = [];

    const snapshotStatus = (): Map<string, Army["status"]> => {
      const m = new Map<string, Army["status"]>();
      for (const a of Object.values(state.armies)) m.set(a.id, a.status);
      return m;
    };

    const before = snapshotStatus();

    this.environmentEngine.applyTick(state);
    this.fogEngine.update(state);

    for (const node of Object.values(state.nodes)) {
      if (!node.isPlagued || node.plagueTicksRemaining <= 0) continue;
      node.resources.troops = Math.floor(
        node.resources.troops * Math.pow(0.95, 1 / TICKS_PER_CALENDAR_DAY),
      );
      node.plagueTicksRemaining -= 1;
      if (node.plagueTicksRemaining <= 0) {
        node.isPlagued = false;
      }
    }

    applyLogisticsPhase(state, logisticsLogs);
    this.pruneRegistries(state);

    const prepMarchingRoutes = (): void => {
      for (const army of Object.values(state.armies)) {
        if (army.status === "MARCHING") {
          startNextRouteIfNeeded(army);
          if (army.currentRouteId) {
            this.stationByArmy.delete(army.id);
          }
        }
      }
    };

    prepMarchingRoutes();
    advanceMarchingProgress(state, this.stationByArmy, movementLogs, MARCH_FRACTION_PER_TICK);

    const arrivals = movementLogs
      .filter((m) => m.arrivedAtNodeId !== null)
      .map((m) => ({ armyId: m.armyId, nodeId: m.arrivedAtNodeId! }));

    runCollisionPhase(
      state,
      arrivals,
      this.stationByArmy,
      this.siegeByArmy,
      this.combatByArmy,
      collisionLogs,
    );

    resolveStationedArmyConflicts(
      state,
      this.stationByArmy,
      this.siegeByArmy,
      this.combatByArmy,
      collisionLogs,
    );

    for (const c of collisionLogs) {
      if (c.outcome === "SIEGE") {
        stateTransitions.push({
          armyId: c.armyId,
          from: "MARCHING",
          to: "SIEGE",
          note: `Arrived at hostile node ${c.nodeId}`,
        });
      } else if (c.outcome === "COMBAT") {
        stateTransitions.push({
          armyId: c.armyId,
          from: "MARCHING",
          to: "COMBAT",
          note: `Met hostile army ${c.enemyArmyId ?? ""}`,
        });
      }
    }

    const combatSeen = new Set<string>();
    for (const army of Object.values(state.armies)) {
      if (army.status !== "COMBAT") continue;
      const other = this.combatByArmy.get(army.id);
      if (!other || !state.armies[other]) continue;
      const a = army.id;
      const b = other;
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      if (combatSeen.has(key)) continue;
      combatSeen.add(key);
      resolveFieldCombatStep(state, a, b, this.stationByArmy, this.combatByArmy, combatLogs);
    }

    this.pruneCombatLinks(state);

    for (const army of Object.values(state.armies)) {
      if (army.status !== "SIEGE") continue;
      const nodeId = this.siegeByArmy.get(army.id);
      if (!nodeId) continue;
      const node = state.nodes[nodeId];
      if (!node) continue;
      resolveSiegeStep(state, army, node, this.stationByArmy, this.siegeByArmy, siegeLogs);
      if (army.status !== "SIEGE") {
        this.siegeByArmy.delete(army.id);
        if (army.status === "IDLE") {
          stateTransitions.push({
            armyId: army.id,
            from: "SIEGE",
            to: "IDLE",
            note: `Captured node ${nodeId}`,
          });
        }
      }
    }

    if (state.currentTick % TICKS_PER_MONTH === 0) {
      runMonthlyEconomyPhase(state, this.createEconomyHooks(), economyLogs);
    }

    if (state.currentTick > 0 && state.currentTick % TICKS_PER_YEAR === 0) {
      this.catastropheEngine.applyYearly(state);
    }

    this.aiEngine.runMacro(state, this);
    this.aiEngine.runTactical(state, this);

    this.pruneRegistries(state);

    const after = snapshotStatus();
    for (const [id, stAfter] of after.entries()) {
      const stBefore = before.get(id);
      if (stBefore !== undefined && stBefore !== stAfter) {
        const already = stateTransitions.some((t) => t.armyId === id);
        if (!already) {
          stateTransitions.push({
            armyId: id,
            from: stBefore,
            to: stAfter,
          });
        }
      }
    }

    this.syncOfficerLocations(state);

    return {
      tick: state.currentTick,
      logistics: logisticsLogs,
      movement: movementLogs,
      collisions: collisionLogs,
      combat: combatLogs,
      siege: siegeLogs,
      economy: economyLogs,
      stateTransitions,
    };
  }
}
