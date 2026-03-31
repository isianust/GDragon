# Project Dragon: Grand Strategy, Environment & AI Engine (Phases 7-9)

## 1. Data Model Upgrades (Interfaces)
Extend existing interfaces with the following properties strictly in standard English:

```typescript
// Add to existing Faction interface (or create if missing)
export interface Faction {
  id: string;
  name: string;
  rulerId: string;
  capitalNodeId: string;
  aiArchetype: "AGGRESSIVE" | "DEFENSIVE" | "CAUTIOUS" | "OPPORTUNIST";
  globalPrestige: number; // 0 to 100
}

// Add to existing Officer interface
export interface Officer {
  // ... existing
  loyalty: number; // 0 to 100
  isDead?: boolean; 
}

// Add to existing MapNode interface
export interface MapNode {
  // ... existing
  visibility?: "FULL" | "ESTIMATE" | "BLIND"; // Calculated relative to Player
}

// Add to existing Route interface
export interface Route {
  // ... existing
  currentWeather: "CLEAR" | "RAIN" | "SNOW" | "FOG";
  weatherDuration: number; // Ticks remaining for the weather
}

// Global Environment State
export interface EnvironmentState {
  currentSeason: "SPRING" | "SUMMER" | "AUTUMN" | "WINTER";
}
2. Fog of War & Intelligence Engine (Phase 7)
Visibility States (Relative to Player):
FULL: Node is owned by Player, adjacent to Player node, or has an active Player spy. Exact troops/resources visible.
ESTIMATE: 1-2 Nodes away from Player vision. Show rough range for troops (e.g., string "2000-5000"). Mask officer names as "???".
BLIND: Deep enemy territory. Only ownerId (Faction color) is visible.
Reconnaissance Command: IDLE Officer scouts a target Node.
If Spy.Intel >> Mayor.Intel: Reveal exact data for 30 Ticks.
If Spy.Intel << Mayor.Intel: Enemy feeds Fake Data (shows completely wrong troop counts).
3. Dynamic Environment & Weather Engine (Phases 7 & 8)
Create a standalone EnvironmentEngine evaluated inside the main Tick loop.

A. Seasonal Cycle (Global)
SPRING (Tick 0-90): Morale recovery +10%.
SUMMER (Tick 91-180): Food consumption rate +20%. WATER routes speed increased.
AUTUMN (Tick 181-270): Harvest Season. City food production yields x1.5.
WINTER (Tick 271-360): Stamina drain while marching x2. MOUNTAIN routes speed -50%. Armies freeze (rapid morale drop) if carriedFood < 20%.
B. Granular Weather (Local Routes)
Every 10 Ticks, randomly select 10-20% of Routes and assign weather based on the Season. Lasts 5-15 Ticks.

CLEAR: Normal.
RAIN (Spring/Summer): PLAIN speed -40% (Mud). WATER speed +20%. Archer damage -50%.
SNOW (Winter only): MOUNTAIN speed -70%. Logistics stamina drain x2.
FOG: Speed -20%. Triggers "Surprise Attack" (300% dmg on first tick of COMBAT if Attacker Intel > Defender Intel).
4. Advanced Movement Engine (Phase 8 - Scale Penalty)
Update the MovementEngine speed calculation to include the Scale Multiplier.

Scale Multiplier Formula:
TotalTroops <= 1000: x1.5
1001 to 5000: x1.0
5001 to 15000: x0.7
> 15000: x0.5
Final Speed Equation:
finalSpeed = baseTerrainSpeed * weatherModifier * scaleModifier * staminaModifier
(staminaModifier = 0.5 if stamina < 20, else 1.0).
5. Dynamic AI Engine (Phase 9)
Create a standalone AIEngine evaluated every Month (30 Ticks) for Macro decisions, and every Tick for Tactical decisions. The AI MUST NOT cheat (obeys FoW and Logistics).

A. Faction Archetypes (Macro)
AGGRESSIVE: Constantly drafts and dispatches armies to the weakest adjacent player node.
DEFENSIVE: Focuses on POLICY_FOCUS_DRAFT. Attacks only if adjacent enemy node troops < 20% of their own border city.
CAUTIOUS: Refuses to move into BLIND nodes. Will dispatch a "Light Vanguard Probe" (500 Cavalry) to trigger combat, reveal Intel, and instantly Retreat before sending the main force.
OPPORTUNIST: Monitors battles. Attacks immediately after a nearby battle concludes.
B. Threat Assessment & Defense Protocols
Priority Queue:
CapitalNode: Absolute priority. If threatened (Enemy 1 route away), trigger DEFEND_CORE. Cancel all expansions, recall armies.
GATE Nodes: Garrison heavily with high-Martial officers.
Frontline CITY: Standard defense.
Rear CITY: Transfer troops/food to Frontline.
C. Tactical Field AI (Micro - Every Tick)
Pursuit: If an enemy retreats, a Low-Intel/High-Martial Commander will ALWAYS pursue. A High-Intel Commander pursues ONLY if Stamina > 50 and carriedFood is sufficient.
Emergency Retreat: During COMBAT/SIEGE, if AI TotalTroops < 30% and Enemy > 60%, High-Intel Commanders automatically execute a Retreat command to avoid capture. Low-Intel fights to the death.