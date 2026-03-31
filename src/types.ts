export type OfficerStatus = "IDLE" | "MARCHING" | "COMBAT" | "SIEGE" | "CAPTURED";
export type ArmyStatus = "IDLE" | "MARCHING" | "COMBAT" | "SIEGE";
export type NodeType = "CITY" | "GATE";
export type RouteType = "PLAIN" | "MOUNTAIN" | "WATER";
export type CityPolicy =
  | "POLICY_FOCUS_GOLD"
  | "POLICY_FOCUS_FOOD"
  | "POLICY_FOCUS_DRAFT"
  | "POLICY_BALANCED"
  | "POLICY_RESTORE_ORDER";

export type AiArchetype = "AGGRESSIVE" | "DEFENSIVE" | "CAUTIOUS" | "OPPORTUNIST";

export type NodeVisibility = "FULL" | "ESTIMATE" | "BLIND";

export type RouteWeather = "CLEAR" | "RAIN" | "SNOW" | "FOG";

export type Season = "SPRING" | "SUMMER" | "AUTUMN" | "WINTER";

export type FactionKind = "WARLORD" | "HORDE" | "BANDIT" | "PIRATE";

export type ActiveEdict = "NONE" | "EDICT_TUNTIAN" | "EDICT_CONSCRIPTION" | "EDICT_MERITOCRACY";

export interface Faction {
  id: string;
  name: string;
  rulerId: string;
  capitalNodeId: string;
  aiArchetype: AiArchetype;
  globalPrestige: number;
  type: FactionKind;
  allianceId: string | null;
  isRebel: boolean;
  activeEdict: ActiveEdict;
  edictDuration: number;
}

export interface EnvironmentState {
  currentSeason: Season;
}

export interface Officer {
  id: string;
  name: string;
  portraitAssetId?: string;
  avatarAssetId?: string;
  stats: {
    command: number;
    martial: number;
    intel: number;
    politics: number;
    luck: number;
  };
  trait: string;
  status: OfficerStatus;
  locationId: string;
  ownerId: string;
  loyalty: number;
  ambition: number;
  bondIds: string[];
  feudFactionId: string | null;
  isDead?: boolean;
}

export interface MapNode {
  id: string;
  name: string;
  spriteAssetId?: string;
  type: NodeType;
  ownerId: string;
  defense: number;
  maxDefense: number;
  resources: { gold: number; food: number; troops: number };
  mayorId: string | null;
  policy: CityPolicy;
  visibility?: NodeVisibility;
  hasEmperor: boolean;
  population: number;
  publicOrder: number;
  isPlagued: boolean;
  /** Remaining ticks of plague effects (e.g. 90 = ~3 months at 1 tick/day). */
  plagueTicksRemaining: number;
}

export interface Route {
  id: string;
  textureAssetId?: string;
  sourceNodeId: string;
  targetNodeId: string;
  type: RouteType;
  distance: number;
  isHidden: boolean;
  currentWeather: RouteWeather;
  weatherDuration: number;
}

export interface Army {
  id: string;
  ownerId: string;
  commanderId: string;
  deputyIds: string[];
  carriedFood: number;
  troops: { cavalry: number; infantry: number; archer: number };
  morale: number;
  stamina: number;
  status: ArmyStatus;
  pathQueue: string[];
  currentRouteId: string | null;
  progress: number;
  targetNodeId: string | null;
  /** Node the army last left when entering the current / last edge (for retreat after defeat). */
  lastEnteredFromNodeId: string | null;
  /** Field combat only: cumulative loss vs start triggers retreat toward another friendly city if any. */
  combatEngagement: {
    troopsAtEngagementStart: number;
    retreatAfterCasualties: number;
  } | null;
}

export interface AiSessionState {
  lastMacroTickByFaction: Record<string, number>;
  /** Faction id -> tick when their coalition mandate expires. */
  coalitionExpiryByFaction: Record<string, number>;
}

export interface GameState {
  currentTick: number;
  officers: Record<string, Officer>;
  nodes: Record<string, MapNode>;
  routes: Record<string, Route>;
  armies: Record<string, Army>;
  factions: Record<string, Faction>;
  environment: EnvironmentState;
  playerFactionId: string;
  aiSession: AiSessionState;
  /** Hidden routes the player (or script) has revealed — same rules for AI pathfinding. */
  revealedRouteIds: string[];
}

export interface Stage1Json {
  officers: Officer[];
  nodes: MapNode[];
  routes: Route[];
  factions: Faction[];
}
