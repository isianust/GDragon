import stage1Json from "../data/stage1.json";
import type {
  EnvironmentState,
  Faction,
  GameState,
  MapNode,
  Officer,
  Route,
  Stage1Json,
} from "./types.ts";

function recordsFromArray<T extends { id: string }>(items: T[]): Record<string, T> {
  const out: Record<string, T> = {};
  for (const item of items) {
    out[item.id] = item;
  }
  return out;
}

export function normalizeFaction(f: Faction): Faction {
  return {
    ...f,
    type: f.type ?? "WARLORD",
    allianceId: f.allianceId ?? null,
    isRebel: f.isRebel ?? false,
    activeEdict: f.activeEdict ?? "NONE",
    edictDuration: f.edictDuration ?? 0,
  };
}

export function normalizeOfficer(o: Officer): Officer {
  return {
    ...o,
    loyalty: o.loyalty ?? 85,
    ambition: o.ambition ?? 30,
    bondIds: o.bondIds ?? [],
    feudFactionId: o.feudFactionId ?? null,
  };
}

export function normalizeMapNode(n: MapNode): MapNode {
  return {
    ...n,
    hasEmperor: n.hasEmperor ?? false,
    population: n.population ?? 10000,
    publicOrder: n.publicOrder ?? 50,
    isPlagued: n.isPlagued ?? false,
    plagueTicksRemaining: n.plagueTicksRemaining ?? 0,
  };
}

function normalizeRoute(r: Route): Route {
  return {
    ...r,
    currentWeather: r.currentWeather ?? "CLEAR",
    weatherDuration: r.weatherDuration ?? 0,
  };
}

export function createEmptyGameState(): GameState {
  const env: EnvironmentState = { currentSeason: "SPRING" };
  return {
    currentTick: 0,
    officers: {},
    nodes: {},
    routes: {},
    armies: {},
    factions: {},
    environment: env,
    playerFactionId: "FAC_SHU",
    aiSession: { lastMacroTickByFaction: {}, coalitionExpiryByFaction: {} },
    revealedRouteIds: [],
  };
}

export function loadStage1Data(raw: Stage1Json): GameState {
  const officers = raw.officers.map((o) => normalizeOfficer(o));
  const routes = raw.routes.map(normalizeRoute);
  const nodes = raw.nodes.map((n) => normalizeMapNode(n));
  const factions: Record<string, Faction> = recordsFromArray(raw.factions.map(normalizeFaction));
  return {
    currentTick: 0,
    officers: recordsFromArray(officers),
    nodes: recordsFromArray(nodes),
    routes: recordsFromArray(routes),
    armies: {},
    factions,
    environment: { currentSeason: "SPRING" },
    playerFactionId: "FAC_SHU",
    aiSession: { lastMacroTickByFaction: {}, coalitionExpiryByFaction: {} },
    revealedRouteIds: [],
  };
}

export function loadStage1Bundled(): GameState {
  return loadStage1Data(stage1Json as Stage1Json);
}
