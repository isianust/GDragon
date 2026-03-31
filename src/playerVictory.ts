import type { GameState } from "./types.ts";

/** 本關勝利目標城池（與 stage1 劇本一致）。 */
export const STAGE_VICTORY_NODE_ID = "CITY_TARGET";

/**
 * 過關：玩家佔領目標城，或任一敵對勢力主公已成玩家俘虜。
 */
export function isPlayerVictorious(state: GameState): boolean {
  const pid = state.playerFactionId;
  const target = state.nodes[STAGE_VICTORY_NODE_ID];
  if (target?.ownerId === pid) return true;

  for (const f of Object.values(state.factions)) {
    if (f.id === pid) continue;
    const ruler = state.officers[f.rulerId];
    if (ruler?.status === "CAPTURED" && ruler.ownerId === pid) return true;
  }
  return false;
}
