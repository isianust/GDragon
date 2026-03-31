import type { GameState, MapNode } from "./types.ts";

function neighbors(state: GameState, nodeId: string): string[] {
  const out: string[] = [];
  for (const r of Object.values(state.routes)) {
    if (r.sourceNodeId === nodeId) out.push(r.targetNodeId);
    if (r.targetNodeId === nodeId) out.push(r.sourceNodeId);
  }
  return out;
}

/**
 * Computes node visibility relative to the player faction (no spy / fake intel yet).
 */
export class FogOfWarEngine {
  update(state: GameState): void {
    const seeds = Object.values(state.nodes)
      .filter((n) => n.ownerId === state.playerFactionId)
      .map((n) => n.id);

    const dist = new Map<string, number>();
    const q: string[] = [...seeds];
    for (const s of seeds) dist.set(s, 0);

    while (q.length > 0) {
      const cur = q.shift()!;
      const d = dist.get(cur) ?? 0;
      if (d >= 3) continue;
      for (const nb of neighbors(state, cur)) {
        if (!dist.has(nb)) {
          dist.set(nb, d + 1);
          q.push(nb);
        }
      }
    }

    const apply = (n: MapNode): void => {
      if (n.ownerId === state.playerFactionId) {
        n.visibility = "FULL";
        return;
      }
      const d = dist.get(n.id);
      if (d === undefined) {
        n.visibility = "BLIND";
        return;
      }
      if (d <= 1) n.visibility = "FULL";
      else if (d === 2) n.visibility = "ESTIMATE";
      else n.visibility = "BLIND";
    };

    for (const n of Object.values(state.nodes)) {
      apply(n);
    }
  }
}
