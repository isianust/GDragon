import type { Army, GameState, MapNode } from "../types.ts";

/**
 * Horde / bandit instant loot: steals a share of stockpiles, weakens walls, does not transfer ownership.
 */
export function executePillageOnCity(_state: GameState, army: Army, node: MapNode): void {
  if (node.type !== "CITY") return;
  const goldSteal = node.resources.gold * 0.28;
  const foodSteal = node.resources.food * 0.28;
  node.resources.gold = Math.max(0, node.resources.gold - goldSteal);
  node.resources.food = Math.max(0, node.resources.food - foodSteal);
  army.carriedFood += foodSteal;
  node.defense = Math.max(0, node.defense - 100);
  node.publicOrder = Math.max(0, node.publicOrder - 12);
}
