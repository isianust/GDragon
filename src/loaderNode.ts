import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadStage1Data } from "./loader.ts";
import type { GameState, Stage1Json } from "./types.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Loads Stage 1 from disk for Node-only scripts (e.g. `src/test.ts`).
 */
export function loadStage1FromDisk(): GameState {
  const path = join(__dirname, "..", "data", "stage1.json");
  const raw = JSON.parse(readFileSync(path, "utf-8")) as Stage1Json;
  return loadStage1Data(raw);
}
