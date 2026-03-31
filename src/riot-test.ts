/**
 * Validates monthly civic economy: starvation + low public order can spawn a bandit riot siege.
 */
import { runMonthlyEconomyPhase } from "./engine/economy.ts";
import { loadStage1FromDisk } from "./loaderNode.ts";
import { TickEngine } from "./tickEngine.ts";

function main(): void {
  const state = loadStage1FromDisk();
  state.currentTick = 360;

  const city = state.nodes["CITY_START"]!;
  city.ownerId = state.playerFactionId;
  city.resources.food = 0;
  city.publicOrder = 10;
  city.resources.troops = 6000;

  const engine = new TickEngine();
  runMonthlyEconomyPhase(state, engine.createEconomyHooks(), [], { riotRoll: () => 0.01 });

  const bandit = Object.values(state.factions).find(
    (f) => f.type === "BANDIT" && f.id.startsWith("FAC_RIOT_"),
  );
  const riotArmy = Object.values(state.armies).find((a) => a.ownerId === bandit?.id);

  if (!bandit || !riotArmy || riotArmy.status !== "SIEGE") {
    console.error("FAIL: expected bandit faction and SIEGE army after riot");
    process.exit(1);
  }
  process.exit(0);
}

main();
