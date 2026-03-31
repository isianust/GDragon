import { dispatchArmyFromCity } from "./dispatch.ts";
import { loadStage1FromDisk } from "./loaderNode.ts";
import { TickEngine } from "./tickEngine.ts";

const ARMY_ID = "ARMY_EXPEDITION_1";

function main(): void {
  const state = loadStage1FromDisk();
  const engine = new TickEngine();

  dispatchArmyFromCity(state, engine, {
    armyId: ARMY_ID,
    fromCityId: "CITY_START",
    commanderId: "OFC_GUAN",
    deputyIds: ["OFC_ZHANG"],
    troops: { cavalry: 10_000, infantry: 0, archer: 0 },
    carriedFood: 10_000,
    pathQueue: ["ROUTE_GATE_TO_TARGET"],
    currentRouteId: "ROUTE_MAIN",
    targetNodeId: "CITY_TARGET",
  });

  console.log("=== Project Dragon — Phase 1–4 self-test (100 ticks) ===\n");

  for (let i = 0; i < 100; i++) {
    const result = engine.tick(state);
    const army = state.armies[ARMY_ID];
    const foodLog = result.logistics.find((l) => l.armyId === ARMY_ID);
    const moveLog = result.movement.filter((m) => m.armyId === ARMY_ID).at(-1);

    console.log(`[Tick ${result.tick}]`);

    if (army) {
      const route = army.currentRouteId
        ? state.routes[army.currentRouteId]
        : null;
      const dist = route?.distance ?? 0;
      console.log(
        `  Army: status=${army.status} route=${army.currentRouteId ?? "—"} progress=${army.progress.toFixed(2)}${route ? ` / ${dist}` : ""} troops=${(army.troops.cavalry + army.troops.infantry + army.troops.archer).toFixed(0)} food=${army.carriedFood.toFixed(2)} morale=${army.morale.toFixed(1)} stamina=${army.stamina.toFixed(1)}`,
      );
    } else {
      console.log("  Army: (disbanded or destroyed)");
    }

    if (foodLog) {
      console.log(
        `  Food drain: ${foodLog.foodDrain.toFixed(2)} → carried ${foodLog.carriedFoodAfter.toFixed(2)}${foodLog.starvationApplied ? " (starvation)" : ""}`,
      );
    }

    if (moveLog) {
      console.log(
        `  Movement: Δprogress ${moveLog.speedApplied.toFixed(2)} (${moveLog.progressBefore.toFixed(2)} → ${moveLog.progressAfter.toFixed(2)})${moveLog.arrivedAtNodeId ? ` → arrived ${moveLog.arrivedAtNodeId}` : ""}`,
      );
    }

    for (const t of result.stateTransitions) {
      if (t.armyId === ARMY_ID) {
        console.log(`  State change: ${t.from} → ${t.to}${t.note ? ` (${t.note})` : ""}`);
      }
    }

    for (const c of result.combat) {
      console.log(
        `  Field combat damage: ${c.attackerId} vs ${c.defenderId} — dealt ${c.damageToDefender.toFixed(2)} / took ${c.damageToAttacker.toFixed(2)}`,
      );
    }

    for (const s of result.siege) {
      if (s.armyId === ARMY_ID) {
        console.log(
          `  Siege damage: base ${s.baseDamage.toFixed(2)} | wall ${s.wallDamage.toFixed(2)} | garrison ${s.garrisonDamage.toFixed(2)} | defense→${s.defenseAfter.toFixed(1)} troops→${s.troopsAfter.toFixed(1)}`,
        );
      }
    }

    if (result.economy.length > 0) {
      for (const e of result.economy) {
        console.log(
          `  Economy (tick ${result.tick}): node ${e.nodeId} Δgold=${e.goldDelta.toFixed(1)} Δfood=${e.foodDelta.toFixed(1)} Δtroops=${e.troopsDelta.toFixed(1)}`,
        );
      }
    }

    console.log("");
  }

  console.log("=== Self-test finished ===");
}

main();
