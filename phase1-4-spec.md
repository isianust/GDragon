# Project Dragon: Headless Engine Specification (Phases 1-4)

## 1. Core Architecture
- **Architecture**: Real-Time with Pause, pure Client-side Headless Engine (View layer will be added later).
- **Tick System**: Continuous loop. 1 Tick = 1 In-Game Day. Base real-world time per Tick = 5000ms.
- **TimeScale**: 1x, 2x, 4x multipliers, and Pause function.
- **Tick Execution Order**:
  1. **Phase A (Logistics & Movement)**: Update progress of marching armies. Apply logistical drains (Food, Stamina). Check starvation.
  2. **Phase B (Collision)**: Check Node/Route collisions. If Army vs Enemy Army -> state becomes `COMBAT`. If Army vs Enemy Node -> state becomes `SIEGE`.
  3. **Phase C (Resolution)**: Execute 1 step of Combat/Siege resolution.
  4. **Phase D (Economy)**: If `Tick % 30 === 0`, trigger City production.

## 2. Core Data Models (TypeScript Interfaces)

```typescript
export interface Officer {
  id: string;
  name: string;
  stats: { command: number; martial: number; intel: number; politics: number; luck: number };
  trait: string;
  status: "IDLE" | "MARCHING" | "COMBAT" | "SIEGE" | "CAPTURED";
  locationId: string; // Node ID or Route ID
  ownerId: string; // Faction ID
}

export interface MapNode {
  id: string;
  name: string;
  type: "CITY" | "GATE";
  ownerId: string;
  defense: number;
  maxDefense: number;
  resources: { gold: number; food: number; troops: number };
  mayorId: string | null;
  policy: "POLICY_FOCUS_GOLD" | "POLICY_FOCUS_FOOD" | "POLICY_FOCUS_DRAFT" | "POLICY_BALANCED";
}

export interface Route {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  type: "PLAIN" | "MOUNTAIN" | "WATER";
  distance: number;
  isHidden: boolean;
}

export interface Army {
  id: string;
  ownerId: string;
  commanderId: string; // Main General Officer ID
  deputyIds: string[]; // Array of max 2 Officer IDs
  carriedFood: number; // Taken from city upon dispatch
  troops: { cavalry: number; infantry: number; archer: number };
  morale: number; // 0 to 100
  stamina: number; // 0 to 100
  status: "IDLE" | "MARCHING" | "COMBAT" | "SIEGE";
  pathQueue: string[]; // Array of Route IDs for pathfinding
  currentRouteId: string | null;
  progress: number; // Distance covered on currentRouteId
  targetNodeId: string | null;
}

export interface GameState {
  currentTick: number;
  officers: Record<string, Officer>;
  nodes: Record<string, MapNode>;
  routes: Record<string, Route>;
  armies: Record<string, Army>;
}


3. Logic Engines & Formulas
A. Formation & Logistics Engine
Max Troops: 5000 * (1 + deputyIds.length).
TotalTroops: cavalry + infantry + archer.
Food Drain (Per Tick): TotalTroops * 0.01 (Deducted from carriedFood).
Starvation: If carriedFood <= 0, deduct stamina -= 1.0 and morale -= 2.0 per Tick. If morale <= 0, Army is instantly disbanded (deleted).
Stamina Drain: Normal marching deducts stamina -= 0.1 per Tick.
B. Movement Engine
Speed by Troop Type:
Cavalry: PLAIN(2.0), MOUNTAIN(0.5), WATER(0.2)
Infantry: PLAIN(1.0), MOUNTAIN(1.2), WATER(0.8)
Archer: PLAIN(0.8), MOUNTAIN(0.8), WATER(1.5)
ActualSpeed: Math.min(...ActiveTroopTypeSpeeds). (Only check troop types where count > 0).
Stamina Penalty: If stamina < 20, ActualSpeed = ActualSpeed / 2.
Pathing: Automatically pop pathQueue[0] into currentRouteId when reaching a Node. progress increments by ActualSpeed every Tick.
C. Combat Engine (Field)
Effective Martial: Commander.Martial + (Deputy1.Martial * 0.2) + (Deputy2.Martial * 0.2). (Skip missing deputies).
Total Combat Power (TCP): TotalTroops * (Morale / 100) * (Stamina / 100) * EffectiveMartial.
Damage Dealt (Per Tick): (My TCP / Enemy TCP) * 100. (Deduct from Enemy TotalTroops, distribute loss evenly among troop types).
Defeat & Capture:
If Enemy TotalTroops <= 0, Army is defeated.
Check Capture Chance for Commander: 30 + (Victor.Martial / 2) %.
If Commander Captured: Change status to CAPTURED, transfer to Victor. If deputyIds exists, deputyIds[0] becomes commanderId, Army suffers -30 morale. Else, Army disbands.
D. Siege Engine (City vs Army)
Wall Damage Reduction: Reduction % = (City.defense / City.maxDefense) * 0.8.
Attacker Damage Split: Base Damage is calculated same as Field Combat (assuming City TCP = City.troops * 1 * 1 * Mayor.Command or 50 if no Mayor).
50% hits Wall (City.defense -= damage). Minimum defense is 0.
50% hits Garrison (City.troops -= damage * (1 - Reduction %)).
Capture: If City.troops <= 0, Attacker captures Node. ownerId changes.
E. Economy Engine (Every 30 Ticks)
Base Yields (Constants): Gold(1000), Food(2000), Draft(500).

If POLICY_FOCUS_GOLD: City.resources.gold += 1000 * (Mayor.Politics / 50)
If POLICY_FOCUS_FOOD: City.resources.food += 2000 * (Mayor.Politics / 50)
If POLICY_FOCUS_DRAFT: City.resources.troops += 500 * (Mayor.Politics / 50)
(If no mayor, treat Politics as 25).
4. Stage 1 Scenario Data (JSON)
Loader should parse this into the GameState.

{
  "officers": [
    { "id": "OFC_LIU", "name": "Liu Bei", "stats": { "command": 75, "martial": 70, "intel": 75, "politics": 80, "luck": 95 }, "trait": "TRAIT_BENEVOLENT", "status": "IDLE", "locationId": "CITY_START", "ownerId": "FAC_SHU" },
    { "id": "OFC_GUAN", "name": "Guan Yu", "stats": { "command": 95, "martial": 98, "intel": 75, "politics": 60, "luck": 80 }, "trait": "TRAIT_WARGOD", "status": "IDLE", "locationId": "CITY_START", "ownerId": "FAC_SHU" },
    { "id": "OFC_ZHANG", "name": "Zhang Fei", "stats": { "command": 85, "martial": 98, "intel": 30, "politics": 22, "luck": 60 }, "trait": "TRAIT_FIERCE", "status": "IDLE", "locationId": "CITY_START", "ownerId": "FAC_SHU" }
  ],
  "nodes": [
    { "id": "CITY_START", "name": "Base Camp", "type": "CITY", "ownerId": "FAC_SHU", "defense": 500, "maxDefense": 500, "resources": { "gold": 50000, "food": 50000, "troops": 15000 }, "mayorId": "OFC_LIU", "policy": "POLICY_FOCUS_GOLD" },
    { "id": "GATE_TIGER", "name": "Tiger Gate", "type": "GATE", "ownerId": "FAC_ENEMY", "defense": 2000, "maxDefense": 2000, "resources": { "gold": 0, "food": 0, "troops": 3000 }, "mayorId": null, "policy": "POLICY_BALANCED" },
    { "id": "CITY_TARGET", "name": "Pingyuan", "type": "CITY", "ownerId": "FAC_ENEMY", "defense": 1000, "maxDefense": 1000, "resources": { "gold": 5000, "food": 5000, "troops": 5000 }, "mayorId": null, "policy": "POLICY_BALANCED" }
  ],
  "routes": [
    { "id": "ROUTE_MAIN", "sourceNodeId": "CITY_START", "targetNodeId": "GATE_TIGER", "type": "PLAIN", "distance": 100, "isHidden": false },
    { "id": "ROUTE_BYPASS", "sourceNodeId": "CITY_START", "targetNodeId": "CITY_TARGET", "type": "MOUNTAIN", "distance": 300, "isHidden": true }
  ]
}

