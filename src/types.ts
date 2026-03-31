/**
 * @file Project Dragon 核心資料模型定義檔。
 *
 * 此檔案定義了遊戲中所有主要實體的 TypeScript 型別與介面，
 * 涵蓋武將、城池、路線、軍隊、勢力以及整體遊戲狀態。
 * 所有遊戲邏輯模組均依賴此處的型別定義。
 */

/**
 * 武將當前狀態。
 * 決定武將能執行的操作及其在遊戲世界中的位置。
 *
 * - `IDLE` — 駐守城池，可被指派
 * - `MARCHING` — 隨軍行進中
 * - `COMBAT` — 參與野戰
 * - `SIEGE` — 參與攻城戰
 * - `CAPTURED` — 被俘虜
 */
export type OfficerStatus = "IDLE" | "MARCHING" | "COMBAT" | "SIEGE" | "CAPTURED";

/**
 * 軍隊當前狀態。
 * 決定軍隊的行為模式與可用指令。
 *
 * - `IDLE` — 駐紮於城池中，等待指令
 * - `MARCHING` — 沿路線行軍中
 * - `COMBAT` — 參與野戰中
 * - `SIEGE` — 正在進行攻城戰
 */
export type ArmyStatus = "IDLE" | "MARCHING" | "COMBAT" | "SIEGE";

/**
 * 地圖節點類型。
 * 定義節點在戰略地圖上的功能角色。
 *
 * - `CITY` — 城池，可產出資源、駐軍、任命太守
 * - `GATE` — 關隘，具備防禦加成的戰略要衝
 */
export type NodeType = "CITY" | "GATE";

/**
 * 路線地形類型。
 * 影響行軍速度與戰鬥條件。
 *
 * - `PLAIN` — 平原，行軍速度正常
 * - `MOUNTAIN` — 山地，行軍速度降低，可能觸發伏擊
 * - `WATER` — 水路，需要水軍支援，可能受天候影響
 */
export type RouteType = "PLAIN" | "MOUNTAIN" | "WATER";

/**
 * 城池內政方針。
 * 決定每回合城池的資源產出偏向。
 *
 * - `POLICY_FOCUS_GOLD` — 重商：優先產出金錢
 * - `POLICY_FOCUS_FOOD` — 重農：優先產出糧食
 * - `POLICY_FOCUS_DRAFT` — 徵兵：優先徵募兵力
 * - `POLICY_BALANCED` — 均衡：各項資源平均發展
 * - `POLICY_RESTORE_ORDER` — 安民：優先恢復城池治安
 */
export type CityPolicy =
  | "POLICY_FOCUS_GOLD"
  | "POLICY_FOCUS_FOOD"
  | "POLICY_FOCUS_DRAFT"
  | "POLICY_BALANCED"
  | "POLICY_RESTORE_ORDER";

/**
 * AI 勢力行為原型。
 * 決定 AI 勢力在戰略決策時的傾向。
 *
 * - `AGGRESSIVE` — 積極進攻型，傾向主動出擊
 * - `DEFENSIVE` — 防守型，傾向固守領地
 * - `CAUTIOUS` — 謹慎型，在確保優勢下才行動
 * - `OPPORTUNIST` — 投機型，善於趁虛而入
 */
export type AiArchetype = "AGGRESSIVE" | "DEFENSIVE" | "CAUTIOUS" | "OPPORTUNIST";

/**
 * 節點可見度等級。
 * 決定玩家對某個地圖節點的情報掌握程度。
 *
 * - `FULL` — 完全可見，可獲取所有詳細資訊
 * - `ESTIMATE` — 模糊估計，僅能大致判斷兵力規模
 * - `BLIND` — 完全未知，無法取得任何情報
 */
export type NodeVisibility = "FULL" | "ESTIMATE" | "BLIND";

/**
 * 路線天候狀態。
 * 影響行軍速度及戰鬥效果。
 *
 * - `CLEAR` — 晴天，無額外影響
 * - `RAIN` — 下雨，降低行軍速度，火攻無效
 * - `SNOW` — 下雪，大幅降低行軍速度與士氣
 * - `FOG` — 起霧，降低可見度，利於伏擊
 */
export type RouteWeather = "CLEAR" | "RAIN" | "SNOW" | "FOG";

/**
 * 遊戲季節。
 * 影響資源產出、天候機率及特定事件觸發。
 *
 * - `SPRING` — 春季
 * - `SUMMER` — 夏季
 * - `AUTUMN` — 秋季
 * - `WINTER` — 冬季
 */
export type Season = "SPRING" | "SUMMER" | "AUTUMN" | "WINTER";

/**
 * 勢力類別。
 * 決定勢力的基本行為規則與特殊機制。
 *
 * - `WARLORD` — 諸侯，正規勢力，可外交、結盟
 * - `HORDE` — 遊牧部落，偏重騎兵與劫掠
 * - `BANDIT` — 山賊，佔據據點騷擾周邊
 * - `PIRATE` — 海盜，控制水路進行劫掠
 */
export type FactionKind = "WARLORD" | "HORDE" | "BANDIT" | "PIRATE";

/**
 * 勢力頒布的詔令。
 * 每個勢力同一時間只能啟用一道詔令，持續一定回合數。
 *
 * - `NONE` — 未頒布任何詔令
 * - `EDICT_TUNTIAN` — 屯田令：提升糧食產出
 * - `EDICT_CONSCRIPTION` — 徵兵令：加速兵力徵募
 * - `EDICT_MERITOCRACY` — 唯才是舉：提升武將忠誠及招募機率
 */
export type ActiveEdict = "NONE" | "EDICT_TUNTIAN" | "EDICT_CONSCRIPTION" | "EDICT_MERITOCRACY";

/**
 * 勢力（Faction）。
 * 代表遊戲中一個政治實體，擁有領地、武將與軍隊。
 */
export interface Faction {
  /** 勢力唯一識別碼。 */
  id: string;
  /** 勢力名稱（如「曹魏」）。 */
  name: string;
  /** 君主武將的 ID，指向 {@link Officer}。 */
  rulerId: string;
  /** 首都節點 ID，指向 {@link MapNode}。 */
  capitalNodeId: string;
  /** AI 行為原型，決定電腦勢力的戰略風格。 */
  aiArchetype: AiArchetype;
  /** 全域威望值，影響外交與事件觸發。 */
  globalPrestige: number;
  /** 勢力類別，決定基礎行為規則。 */
  type: FactionKind;
  /** 所屬同盟 ID；若未加入同盟則為 `null`。 */
  allianceId: string | null;
  /** 是否為叛軍勢力。 */
  isRebel: boolean;
  /** 當前頒布的詔令。 */
  activeEdict: ActiveEdict;
  /** 詔令剩餘持續回合數。 */
  edictDuration: number;
}

/**
 * 環境狀態。
 * 儲存影響全局的環境資訊，如季節。
 */
export interface EnvironmentState {
  /** 當前季節，影響資源產出與天候機率。 */
  currentSeason: Season;
}

/**
 * 武將（Officer）。
 * 代表遊戲中的個別角色，可擔任太守、軍隊指揮官等職務。
 */
export interface Officer {
  /** 武將唯一識別碼。 */
  id: string;
  /** 武將姓名。 */
  name: string;
  /** 肖像圖片素材 ID（可選）。 */
  portraitAssetId?: string;
  /** 頭像圖片素材 ID（可選）。 */
  avatarAssetId?: string;
  /** 武將五維能力值。 */
  stats: {
    /** 統率：影響軍隊規模上限與部隊士氣。 */
    command: number;
    /** 武力：影響野戰與單挑傷害。 */
    martial: number;
    /** 智力：影響計策成功率與防禦。 */
    intel: number;
    /** 政治：影響城池內政效率。 */
    politics: number;
    /** 幸運：影響隨機事件與暴擊機率。 */
    luck: number;
  };
  /** 武將特性（trait），賦予被動效果或技能。 */
  trait: string;
  /** 武將當前狀態。 */
  status: OfficerStatus;
  /** 武將當前所在節點 ID，指向 {@link MapNode}。 */
  locationId: string;
  /** 所屬勢力 ID，指向 {@link Faction}。 */
  ownerId: string;
  /** 忠誠度（0–100），過低時可能叛逃。 */
  loyalty: number;
  /** 野心值（0–100），過高時可能自立或叛變。 */
  ambition: number;
  /** 與其他武將的羈絆（bond）ID 列表。 */
  bondIds: string[];
  /** 與之有仇怨的勢力 ID；無仇怨時為 `null`。 */
  feudFactionId: string | null;
  /** 武將是否已死亡（可選，預設為存活）。 */
  isDead?: boolean;
}

/**
 * 地圖節點（MapNode）。
 * 代表戰略地圖上的城池或關隘，是領地控制與資源產出的基本單位。
 */
export interface MapNode {
  /** 節點唯一識別碼。 */
  id: string;
  /** 節點名稱（如「許昌」）。 */
  name: string;
  /** 地圖上的精靈圖素材 ID（可選）。 */
  spriteAssetId?: string;
  /** 節點類型（城池或關隘）。 */
  type: NodeType;
  /** 擁有此節點的勢力 ID，指向 {@link Faction}。 */
  ownerId: string;
  /** 當前城防值，被攻城時逐漸降低。 */
  defense: number;
  /** 城防值上限。 */
  maxDefense: number;
  /** 城池資源儲量。 */
  resources: {
    /** 金錢儲量。 */
    gold: number;
    /** 糧食儲量。 */
    food: number;
    /** 可用兵力儲量。 */
    troops: number;
  };
  /** 太守武將 ID；無太守時為 `null`。指向 {@link Officer}。 */
  mayorId: string | null;
  /** 城池當前內政方針。 */
  policy: CityPolicy;
  /** 該節點對玩家的可見度（可選）。 */
  visibility?: NodeVisibility;
  /** 是否擁有天子（皇帝），擁有天子可獲得正統性加成。 */
  hasEmperor: boolean;
  /** 城池人口數量，影響資源產出上限與徵兵規模。 */
  population: number;
  /** 治安值（0–100），過低時可能爆發叛亂。 */
  publicOrder: number;
  /** 城池是否正受瘟疫影響。 */
  isPlagued: boolean;
  /** 瘟疫剩餘回合數（如 90 ≈ 3 個月, 以每日 1 tick 計算）。 */
  plagueTicksRemaining: number;
}

/**
 * 路線（Route）。
 * 連接兩個地圖節點的行軍通道，具有地形與天候屬性。
 */
export interface Route {
  /** 路線唯一識別碼。 */
  id: string;
  /** 路線材質素材 ID（可選）。 */
  textureAssetId?: string;
  /** 起點節點 ID，指向 {@link MapNode}。 */
  sourceNodeId: string;
  /** 終點節點 ID，指向 {@link MapNode}。 */
  targetNodeId: string;
  /** 路線地形類型，影響行軍速度。 */
  type: RouteType;
  /** 路線距離（以 tick 為單位的基礎行軍時間）。 */
  distance: number;
  /** 是否為隱藏路線，需探索後才可使用。 */
  isHidden: boolean;
  /** 路線當前天候狀態。 */
  currentWeather: RouteWeather;
  /** 當前天候剩餘持續回合數。 */
  weatherDuration: number;
}

/**
 * 軍隊（Army）。
 * 代表一支可在地圖上移動並參與戰鬥的部隊。
 */
export interface Army {
  /** 軍隊唯一識別碼。 */
  id: string;
  /** 所屬勢力 ID，指向 {@link Faction}。 */
  ownerId: string;
  /** 主將武將 ID，指向 {@link Officer}。 */
  commanderId: string;
  /** 副將武將 ID 列表，指向 {@link Officer}。 */
  deputyIds: string[];
  /** 攜帶的糧食數量，行軍時逐漸消耗。 */
  carriedFood: number;
  /** 部隊兵種組成。 */
  troops: {
    /** 騎兵數量。 */
    cavalry: number;
    /** 步兵數量。 */
    infantry: number;
    /** 弓兵數量。 */
    archer: number;
  };
  /** 士氣值（0–100），影響戰鬥力與潰逃機率。 */
  morale: number;
  /** 體力值（0–100），行軍與戰鬥時消耗。 */
  stamina: number;
  /** 軍隊當前狀態。 */
  status: ArmyStatus;
  /** 行軍路徑佇列，儲存依序經過的路線 ID。 */
  pathQueue: string[];
  /** 當前行軍所在路線 ID；未行軍時為 `null`。指向 {@link Route}。 */
  currentRouteId: string | null;
  /** 在當前路線上的行軍進度（0.0–1.0）。 */
  progress: number;
  /** 目標節點 ID；無目標時為 `null`。指向 {@link MapNode}。 */
  targetNodeId: string | null;
  /** 軍隊進入當前路線時的出發節點 ID，用於戰敗後撤退。 */
  lastEnteredFromNodeId: string | null;
  /** 野戰交戰資訊：記錄交戰初始兵力與觸發撤退的傷亡門檻；未交戰時為 `null`。 */
  combatEngagement: {
    /** 交戰開始時的總兵力。 */
    troopsAtEngagementStart: number;
    /** 累計傷亡達此數值後觸發撤退。 */
    retreatAfterCasualties: number;
  } | null;
}

/**
 * AI 回合狀態。
 * 追蹤 AI 勢力的決策時序與聯盟資訊。
 */
export interface AiSessionState {
  /** 各勢力上次執行宏觀決策的 tick，鍵為勢力 ID。 */
  lastMacroTickByFaction: Record<string, number>;
  /** 各勢力聯盟授權到期的 tick，鍵為勢力 ID。 */
  coalitionExpiryByFaction: Record<string, number>;
}

/**
 * 遊戲總狀態（GameState）。
 * 儲存整個遊戲世界的完整快照，包含所有實體與環境資訊。
 */
export interface GameState {
  /** 當前遊戲回合數（tick）。 */
  currentTick: number;
  /** 所有武將，鍵為武將 ID。 */
  officers: Record<string, Officer>;
  /** 所有地圖節點，鍵為節點 ID。 */
  nodes: Record<string, MapNode>;
  /** 所有路線，鍵為路線 ID。 */
  routes: Record<string, Route>;
  /** 所有軍隊，鍵為軍隊 ID。 */
  armies: Record<string, Army>;
  /** 所有勢力，鍵為勢力 ID。 */
  factions: Record<string, Faction>;
  /** 環境狀態（季節等全域環境資訊）。 */
  environment: EnvironmentState;
  /** 玩家控制的勢力 ID。 */
  playerFactionId: string;
  /** AI 回合狀態資訊。 */
  aiSession: AiSessionState;
  /** 已被玩家或腳本揭露的隱藏路線 ID 列表，AI 尋路亦適用相同規則。 */
  revealedRouteIds: string[];
}

/**
 * 第一階段 JSON 資料格式。
 * 用於遊戲初始化時從 JSON 檔案載入的資料結構。
 */
export interface Stage1Json {
  /** 初始武將列表。 */
  officers: Officer[];
  /** 初始地圖節點列表。 */
  nodes: MapNode[];
  /** 初始路線列表。 */
  routes: Route[];
  /** 初始勢力列表。 */
  factions: Faction[];
}
