import { loadStage1FromDisk } from "./loaderNode.ts";
import { TickEngine } from "./tickEngine.ts";

const engine = new TickEngine();
const state = loadStage1FromDisk();

let found = false;
for (let i = 0; i < 900; i++) {
  engine.tick(state);
  const enemyArmy = Object.values(state.armies).find((a) => a.ownerId === "FAC_ENEMY");
  if (enemyArmy) {
    found = true;
    console.log(
      `AI dispatch detected at tick ${state.currentTick}: army ${enemyArmy.id} status=${enemyArmy.status} target=${enemyArmy.targetNodeId}`,
    );
    break;
  }
}

if (!found) {
  console.error("FAIL: no FAC_ENEMY army spawned within 900 ticks");
  process.exit(1);
}

process.exit(0);
