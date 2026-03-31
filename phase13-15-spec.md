# Project Dragon: Sandbox, Geopolitics & Catastrophe Engine (Phases 10-12)

## 1. Data Model Upgrades (Interfaces)
Extend existing interfaces with the following properties strictly in standard English:

```typescript
export interface Faction {
  // ... existing properties
  type: "WARLORD" | "HORDE" | "BANDIT" | "PIRATE";
  allianceId: string | null; // For Coalitions
  isRebel: boolean;
  activeEdict: "NONE" | "EDICT_TUNTIAN" | "EDICT_CONSCRIPTION" | "EDICT_MERITOCRACY";
  edictDuration: number; // Ticks remaining (max 360)
}

export interface MapNode {
  // ... existing properties
  hasEmperor: boolean;
  population: number;
  publicOrder: number; // 0 to 100
  isPlagued: boolean;
  // Note: policy can now also be "POLICY_RESTORE_ORDER"
}

export interface Officer {
  // ... existing properties
  loyalty: number; // 0 to 100
  ambition: number; // 0 to 100
  bondIds: string[]; // Array of Officer IDs
  feudFactionId: string | null; // Faction ID they will never surrender to
}
2. Geopolitics & Grand Strategy (Phase 10)
A. The Emperor & Coalitions
Emperor Node: The Faction controlling the node with hasEmperor: true gains globalPrestige += 5 every 30 Ticks. They can issue a Decree once per Year (360 Ticks) to mark one target Faction as isRebel: true (-20% Morale penalty for 6 Months).
Dynamic Coalition: Checked every Month. If any Faction has globalPrestige > 80 AND controls > 30% of total nodes -> trigger COALITION_EVENT. Independent AI factions with globalPrestige < 50 form an alliance (allianceId = "COALITION_AGAINST_[Target]") and coordinate attacks on the target for 1 Year.
B. Bonds & Feuds
Feuds: If Faction A executes an officer, the victim's bonded friends (bondIds) set their feudFactionId to Faction A. They have a 0% capture chance, lock morale at 100, and gain +20 Martial when fighting Faction A.
Bonds: If a Commander and Deputy share a bond, the Army gains +30% Total Combat Power (TCP).
C. Grand Edicts
Rulers can enact one Edict per Year (360 Ticks):

EDICT_TUNTIAN: Marching Armies consume 50% less Food.
EDICT_CONSCRIPTION: Draft yields +100%, but City Food production drops by 30%.
EDICT_MERITOCRACY: Officer Loyalty drop pauses, Capture Chance +20%.
3. Dynamic Sandbox & Vagrants (Phase 11)
Horde Mechanic: If a WARLORD faction loses its last node, type becomes HORDE. Resources are moved to the Ruler's Army. If Ruler's Army is destroyed, faction is eliminated.
Pillage Command: HORDE or BANDIT armies can execute PILLAGE on a node instead of SIEGE. Instantly steals a % of Gold/Food and drops defense without taking over the city.
Raise Banner: A FREE officer with ambition > 70 arriving at an empty node or node with < 1000 troops instantly creates a new Faction, spawns a 2000-troop militia, and becomes Ruler.
4. Civic Ecosystem & Catastrophes (Phase 12)
Update EconomyEngine (Monthly / 30 Ticks) and create CatastropheEngine (Yearly / 360 Ticks).

A. Public Order & Starvation (Economy Engine Update)
publicOrder naturally trends toward 50. War exhaustion (city attacked) causes -10. POLICY_RESTORE_ORDER spends gold to increase it.
Starvation Consequences (If City food <= 0):
Garrison suffers 20% Desertion.
Officers suffer -10 Loyalty.
RIOT TRIGGER: If publicOrder < 20 AND food <= 0, 50% chance to trigger Riot: City loses 50% Gold, defense drops by 200, a BANDIT faction is instantly spawned on the node triggering an immediate SIEGE.
B. Catastrophe Engine (Yearly Roll)
Locust Swarm: 1 random City + connected nodes. Food drops to 0 instantly, population -10%.
Plague: Node isPlagued = true for 3 Months. Garrison decreases 5% per Tick. Officers pass Luck check or get "SICK" (stats -50%).
Earthquake/Flood: Drops Mountain/Water node defense to 0. Instantly destroys armies marching on affected routes.