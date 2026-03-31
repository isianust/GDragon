/** Screen-space layout for Stage 1 nodes (view layer only; engine remains coordinate-agnostic). */
export const NODE_SCREEN_POSITIONS: Record<string, { x: number; y: number }> = {
  CITY_START: { x: 140, y: 300 },
  GATE_TIGER: { x: 420, y: 240 },
  CITY_TARGET: { x: 720, y: 300 },
};
