import { TickEngine } from "./tickEngine.ts";
import type { Army, GameState } from "./types.ts";
import { getMaxTroopsForArmy } from "./engine/formation.ts";
import { syncOfficerStatusForArmy } from "./engine/combat.ts";

export interface DispatchParams {
  armyId: string;
  fromCityId: string;
  commanderId: string;
  deputyIds: string[];
  troops: Army["troops"];
  carriedFood: number;
  pathQueue: string[];
  currentRouteId: string;
  targetNodeId: string;
}

export function dispatchArmyFromCity(
  state: GameState,
  engine: TickEngine,
  params: DispatchParams,
): Army {
  const city = state.nodes[params.fromCityId];
  if (!city) {
    throw new Error(`City not found: ${params.fromCityId}`);
  }

  const total =
    params.troops.cavalry + params.troops.infantry + params.troops.archer;
  const cap = getMaxTroopsForArmy(params.deputyIds.length);
  if (total > cap) {
    throw new Error(`Troop count ${total} exceeds cap ${cap}`);
  }
  if (params.carriedFood > city.resources.food) {
    throw new Error("Insufficient city food for dispatch");
  }
  if (total > city.resources.troops) {
    throw new Error("Insufficient city troops for dispatch");
  }

  city.resources.troops -= total;
  city.resources.food -= params.carriedFood;

  const army: Army = {
    id: params.armyId,
    ownerId: city.ownerId,
    commanderId: params.commanderId,
    deputyIds: [...params.deputyIds],
    carriedFood: params.carriedFood,
    troops: {
      cavalry: params.troops.cavalry,
      infantry: params.troops.infantry,
      archer: params.troops.archer,
    },
    morale: 100,
    stamina: 100,
    status: "MARCHING",
    pathQueue: [...params.pathQueue],
    currentRouteId: params.currentRouteId,
    progress: 0,
    targetNodeId: params.targetNodeId,
    lastEnteredFromNodeId: params.fromCityId,
    combatEngagement: null,
  };

  state.armies[params.armyId] = army;
  engine.setArmyStation(army.id, params.fromCityId);
  syncOfficerStatusForArmy(state, army, "MARCHING");

  return army;
}
