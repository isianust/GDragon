import type { GameState, Route } from "./types.ts";

export interface DispatchRoutePlan {
  currentRouteId: string;
  pathQueue: string[];
}

/**
 * Directed BFS over routes. Skips hidden routes unless they are explicitly revealed.
 */
export function findDispatchRoutePlan(
  state: GameState,
  fromNodeId: string,
  toNodeId: string,
  revealedHiddenRouteIds: ReadonlySet<string>,
): DispatchRoutePlan | null {
  if (fromNodeId === toNodeId) return null;

  const outgoing = new Map<string, Route[]>();
  for (const route of Object.values(state.routes)) {
    if (route.isHidden && !revealedHiddenRouteIds.has(route.id)) continue;
    const list = outgoing.get(route.sourceNodeId);
    if (list) list.push(route);
    else outgoing.set(route.sourceNodeId, [route]);
  }

  type QueueItem = { nodeId: string; routes: Route[] };
  const queue: QueueItem[] = [{ nodeId: fromNodeId, routes: [] }];
  const visited = new Set<string>([fromNodeId]);

  while (queue.length > 0) {
    const cur = queue.shift()!;
    const nextRoutes = outgoing.get(cur.nodeId);
    if (!nextRoutes) continue;
    for (const route of nextRoutes) {
      const nextNode = route.targetNodeId;
      const pathRoutes = [...cur.routes, route];
      if (nextNode === toNodeId) {
        const ids = pathRoutes.map((r) => r.id);
        return {
          currentRouteId: ids[0]!,
          pathQueue: ids.slice(1),
        };
      }
      if (!visited.has(nextNode)) {
        visited.add(nextNode);
        queue.push({ nodeId: nextNode, routes: pathRoutes });
      }
    }
  }
  return null;
}
