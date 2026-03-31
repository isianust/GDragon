import type { GameState } from "./types.ts";

/** Player loses if their faction commander-in-chief is lost or they hold no cities. */
export function isPlayerDefeated(state: GameState): boolean {
  const pid = state.playerFactionId;
  const fac = state.factions[pid];
  if (!fac) return true;
  const lord = state.officers[fac.rulerId];
  if (!lord || lord.isDead) return true;
  if (lord.status === "CAPTURED" && lord.ownerId !== pid) return true;
  const hasCity = Object.values(state.nodes).some(
    (n) => n.type === "CITY" && n.ownerId === pid,
  );
  return !hasCity;
}
