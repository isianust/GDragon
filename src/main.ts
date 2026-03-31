import "./style.css";
import { AssetManager } from "./AssetManager.ts";
import { dispatchArmyFromCity } from "./dispatch.ts";
import { exportGameState, importGameState } from "./gamePersistence.ts";
import { SCENARIO_STAGE_NUMBER } from "./gameMeta.ts";
import { getLocale, setLocale, subscribeLocale, t } from "./i18n/i18n.ts";
import type { LocaleId } from "./i18n/localeId.ts";
import {
  loadStage1Bundled,
  normalizeFaction,
  normalizeMapNode,
  normalizeOfficer,
} from "./loader.ts";
import { MapCanvasRenderer } from "./mapCanvas.ts";
import { tickCalendar, TICKS_PER_MONTH } from "./gameTime.ts";
import { findDispatchRoutePlan } from "./pathfind.ts";
import { isPlayerDefeated } from "./playerDefeat.ts";
import { isPlayerVictorious } from "./playerVictory.ts";
import { SimulationScheduler } from "./simulationScheduler.ts";
import type { CityPolicy, GameState, MapNode } from "./types.ts";
import {
  formatOfficerCombatPowerDisplay,
  formatOfficerCourtRole,
  formatOfficerMilitaryLine,
  formatRosterLocation,
  formatRosterStatus,
} from "./rosterLabels.ts";
import { TickEngine } from "./tickEngine.ts";

const PLAYER_FACTION_ID = "FAC_SHU";

function sumFactionResources(state: GameState, factionId: string): {
  gold: number;
  food: number;
} {
  let gold = 0;
  let food = 0;
  for (const n of Object.values(state.nodes)) {
    if (n.ownerId === factionId) {
      gold += n.resources.gold;
      food += n.resources.food;
    }
  }
  return { gold, food };
}

function replaceGameStateInPlace(target: GameState, source: GameState): void {
  target.currentTick = source.currentTick;
  target.officers = source.officers;
  target.nodes = source.nodes;
  target.routes = source.routes;
  target.armies = source.armies;
  for (const a of Object.values(target.armies)) {
    if (a.lastEnteredFromNodeId === undefined) a.lastEnteredFromNodeId = null;
    if (a.combatEngagement === undefined) a.combatEngagement = null;
  }
  target.factions = source.factions ?? {};
  target.environment = source.environment ?? { currentSeason: "SPRING" };
  target.playerFactionId = source.playerFactionId ?? PLAYER_FACTION_ID;
  const srcSession = source.aiSession ?? { lastMacroTickByFaction: {}, coalitionExpiryByFaction: {} };
  target.aiSession = {
    lastMacroTickByFaction: srcSession.lastMacroTickByFaction ?? {},
    coalitionExpiryByFaction: srcSession.coalitionExpiryByFaction ?? {},
  };
  target.revealedRouteIds = source.revealedRouteIds ?? [];
  for (const [id, n] of Object.entries(target.nodes)) {
    target.nodes[id] = normalizeMapNode(n);
  }
  for (const [id, f] of Object.entries(target.factions)) {
    target.factions[id] = normalizeFaction(f);
  }
  for (const [id, o] of Object.entries(target.officers)) {
    target.officers[id] = normalizeOfficer(o);
  }
}

function nextArmyId(): string {
  const c = globalThis.crypto?.randomUUID?.();
  return c ? `ARMY_${c}` : `ARMY_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function mountApp(): void {
  const root = document.querySelector<HTMLDivElement>("#app")!;
  root.className = "game-root";
  root.innerHTML = `
    <div class="map-stack">
      <div class="map-backdrop" aria-hidden="true"></div>
      <canvas id="map-canvas"></canvas>
    </div>
    <div id="title-overlay" class="title-overlay glass-panel">
      <div class="title-inner">
        <p class="title-year" data-i18n-key="title.line1"></p>
        <h1 class="title-name" data-i18n-key="title.line2"></h1>
        <p class="title-hint" data-i18n-key="title.tap"></p>
      </div>
    </div>
    <div id="game-over-overlay" class="game-over-overlay" aria-hidden="true">
      <div class="glass-panel game-over-panel">
        <h2 id="game-end-title" data-i18n-key="gameOver.title"></h2>
        <p id="game-end-body" data-i18n-key="gameOver.body"></p>
      </div>
    </div>
    <header class="glass-panel top-header">
      <div class="header-left">
        <div class="header-stats">
          <span id="stat-gold"></span>
          <span id="stat-food"></span>
          <span id="stat-stage"></span>
          <span id="stat-date"></span>
        </div>
      </div>
      <div class="header-actions">
        <label class="locale-wrap glass-panel">
          <select id="locale-switch"></select>
        </label>
        <div class="time-controls glass-panel">
          <button type="button" class="glass-button" id="btn-pause"></button>
          <label class="timescale-bar">
            <span class="timescale-lbl" data-i18n-key="header.timescale"></span>
            <input type="range" id="timescale-slider" min="1" max="4" step="1" value="1" disabled />
            <span id="timescale-value" class="timescale-value">1×</span>
          </label>
        </div>
        <button type="button" class="glass-button" id="btn-load"></button>
      </div>
    </header>
    <aside id="officer-roster" class="glass-panel officer-roster" aria-label="officers">
      <button type="button" id="roster-toggle" class="roster-toggle glass-button" aria-expanded="true"></button>
      <div id="roster-body" class="roster-body"></div>
    </aside>
    <aside id="node-context" class="glass-panel context-menu" role="dialog" aria-label="Node"></aside>
    <div id="dispatch-backdrop" class="modal-backdrop" aria-hidden="true">
      <div class="glass-panel dispatch-modal" role="dialog" aria-modal="true">
        <h2 id="dispatch-title"></h2>
        <div class="form-grid">
          <label><span class="dispatch-lbl" data-i18n-key="dispatch.commander"></span>
            <select id="dispatch-commander"></select>
          </label>
          <label><span class="dispatch-lbl" data-i18n-key="dispatch.deputy1"></span>
            <select id="dispatch-deputy-1"></select>
          </label>
          <label><span class="dispatch-lbl" data-i18n-key="dispatch.deputy2"></span>
            <select id="dispatch-deputy-2"></select>
          </label>
          <label><span class="dispatch-lbl" data-i18n-key="dispatch.totalTroops"></span>
            <input type="number" id="dispatch-troops" min="1" step="1" value="3000" />
          </label>
          <label><span class="dispatch-lbl" data-i18n-key="dispatch.carriedFood"></span>
            <input type="number" id="dispatch-food" min="0" step="1" value="1500" />
          </label>
          <label><span class="dispatch-lbl" data-i18n-key="dispatch.target"></span>
            <select id="dispatch-target"></select>
          </label>
        </div>
        <p id="dispatch-hint" class="dispatch-hint"></p>
        <div class="modal-actions">
          <button type="button" class="glass-button" id="dispatch-cancel"></button>
          <button type="button" class="glass-button" id="dispatch-confirm"></button>
        </div>
      </div>
    </div>
  `;

  const canvas = document.querySelector<HTMLCanvasElement>("#map-canvas")!;
  const titleOverlay = document.querySelector<HTMLDivElement>("#title-overlay")!;
  const statGold = document.querySelector<HTMLSpanElement>("#stat-gold")!;
  const statFood = document.querySelector<HTMLSpanElement>("#stat-food")!;
  const statStage = document.querySelector<HTMLSpanElement>("#stat-stage")!;
  const statDate = document.querySelector<HTMLSpanElement>("#stat-date")!;
  const btnPause = document.querySelector<HTMLButtonElement>("#btn-pause")!;
  const btnLoad = document.querySelector<HTMLButtonElement>("#btn-load")!;
  const localeSwitch = document.querySelector<HTMLSelectElement>("#locale-switch")!;
  const timeScaleSlider = document.querySelector<HTMLInputElement>("#timescale-slider")!;
  const timeScaleValueEl = document.querySelector<HTMLSpanElement>("#timescale-value")!;
  const rosterToggle = document.querySelector<HTMLButtonElement>("#roster-toggle")!;
  const rosterBody = document.querySelector<HTMLDivElement>("#roster-body")!;
  const contextEl = document.querySelector<HTMLDivElement>("#node-context")!;
  const backdrop = document.querySelector<HTMLDivElement>("#dispatch-backdrop")!;
  const dispatchTitle = document.querySelector<HTMLHeadingElement>("#dispatch-title")!;
  const dispatchCommander = document.querySelector<HTMLSelectElement>("#dispatch-commander")!;
  const dispatchDeputy1 = document.querySelector<HTMLSelectElement>("#dispatch-deputy-1")!;
  const dispatchDeputy2 = document.querySelector<HTMLSelectElement>("#dispatch-deputy-2")!;
  const dispatchTroops = document.querySelector<HTMLInputElement>("#dispatch-troops")!;
  const dispatchFood = document.querySelector<HTMLInputElement>("#dispatch-food")!;
  const dispatchTarget = document.querySelector<HTMLSelectElement>("#dispatch-target")!;
  const dispatchHint = document.querySelector<HTMLParagraphElement>("#dispatch-hint")!;
  const dispatchCancel = document.querySelector<HTMLButtonElement>("#dispatch-cancel")!;
  const dispatchConfirm = document.querySelector<HTMLButtonElement>("#dispatch-confirm")!;

  const gameState = loadStage1Bundled();
  const engine = new TickEngine();
  const assets = AssetManager.getInstance();
  const officerRosterEl = document.querySelector<HTMLDivElement>("#officer-roster")!;
  const ROSTER_COLLAPSED_KEY = "dragon-roster-collapsed";

  function readRosterCollapsed(): boolean {
    try {
      return localStorage.getItem(ROSTER_COLLAPSED_KEY) === "1";
    } catch {
      return false;
    }
  }

  function persistRosterCollapsed(collapsed: boolean): void {
    try {
      localStorage.setItem(ROSTER_COLLAPSED_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  function syncRosterPanelChrome(): void {
    const collapsed = officerRosterEl.classList.contains("collapsed");
    rosterToggle.textContent = collapsed ? t("roster.expand") : t("roster.collapse");
    rosterToggle.setAttribute("aria-expanded", String(!collapsed));
  }

  officerRosterEl.classList.toggle("collapsed", readRosterCollapsed());
  syncRosterPanelChrome();
  timeScaleSlider.disabled = true;

  const renderer = new MapCanvasRenderer(canvas, () => gameState, () => engine);

  let dispatchFromNodeId: string | null = null;
  let pauseActive = false;
  let gameStarted = false;
  let gameEndShown = false;
  let scheduler: SimulationScheduler | null = null;

  function showGameEnd(kind: "victory" | "defeat"): void {
    const go = document.querySelector<HTMLDivElement>("#game-over-overlay");
    if (!go) return;
    const title = go.querySelector<HTMLHeadingElement>("#game-end-title");
    const body = go.querySelector<HTMLParagraphElement>("#game-end-body");
    if (title) title.textContent = t(kind === "victory" ? "victory.title" : "gameOver.title");
    if (body) body.textContent = t(kind === "victory" ? "victory.body" : "gameOver.body");
    go.classList.toggle("victory", kind === "victory");
    go.classList.add("visible");
    go.setAttribute("aria-hidden", "false");
  }

  function hideGameEndOverlay(): void {
    const go = document.querySelector<HTMLDivElement>("#game-over-overlay");
    go?.classList.remove("visible", "victory");
    go?.setAttribute("aria-hidden", "true");
  }

  function applyI18nToElements(): void {
    for (const el of root.querySelectorAll("[data-i18n-key]")) {
      const key = el.getAttribute("data-i18n-key");
      if (!key) continue;
      el.textContent = t(key);
    }
    dispatchTitle.textContent = t("dispatch.title");
    dispatchCancel.textContent = t("dispatch.cancel");
    dispatchConfirm.textContent = t("dispatch.confirm");
    btnLoad.textContent = t("header.load");
    btnLoad.title = t("header.loadTitle");
    renderer.setCanvasAccessibilityLabel(t("map.canvasLabel"));
    contextEl.setAttribute("aria-label", t("map.canvasLabel"));
    officerRosterEl.setAttribute("aria-label", t("roster.title"));

    localeSwitch.innerHTML = `
      <option value="zh-Hant">${t("locale.zhHant")}</option>
      <option value="zh-Hans">${t("locale.zhHans")}</option>
      <option value="en">${t("locale.en")}</option>
    `;
    localeSwitch.value = getLocale();
    localeSwitch.setAttribute("aria-label", t("header.language"));
    syncRosterPanelChrome();

    const goOv = document.querySelector<HTMLDivElement>("#game-over-overlay");
    if (goOv?.classList.contains("visible")) {
      showGameEnd(goOv.classList.contains("victory") ? "victory" : "defeat");
    }
  }

  function refreshHeader(): void {
    const { gold, food } = sumFactionResources(gameState, PLAYER_FACTION_ID);
    statGold.textContent = `${t("header.gold")}：${Math.round(gold)}`;
    statFood.textContent = `${t("header.food")}：${Math.round(food)}`;
    statStage.textContent = t("header.stage", { n: SCENARIO_STAGE_NUMBER });
    const { day, branchName, half } = tickCalendar(gameState.currentTick);
    const halfLabel = t(half === "upper" ? "calendar.halfUpper" : "calendar.halfLower");
    statDate.textContent = t("header.calendar", { day, branch: branchName, half: halfLabel });
  }

  function refreshOfficerRoster(): void {
    const header = `<div class="roster-head">${t("roster.title")}</div>
      <div class="roster-row roster-row-head"><span>${t("roster.colName")}</span><span>${t("roster.colRole")}</span><span>${t("roster.colSide")}</span><span>${t("roster.colStatus")}</span><span>${t("roster.colPower")}</span><span>${t("roster.colTroops")}</span><span>${t("roster.colMorale")}</span><span>${t("roster.colStamina")}</span><span>${t("roster.colLocation")}</span></div>`;
    const rows = Object.values(gameState.officers)
      .filter((o) => !o.isDead)
      .sort((a, b) => {
        const sa = a.ownerId === PLAYER_FACTION_ID ? 0 : 1;
        const sb = b.ownerId === PLAYER_FACTION_ID ? 0 : 1;
        if (sa !== sb) return sa - sb;
        return a.name.localeCompare(b.name, "zh-Hant");
      })
      .map((o) => {
        const side =
          o.ownerId === PLAYER_FACTION_ID ? t("roster.ourSide") : t("roster.enemySide");
        const roleLabel = formatOfficerCourtRole(o, gameState, t);
        const statusLabel = formatRosterStatus(o.status, t);
        const powerLabel = formatOfficerCombatPowerDisplay(gameState, o);
        const locLabel = formatRosterLocation(gameState, o, t);
        const mil = formatOfficerMilitaryLine(gameState, o);
        return `<div class="roster-row"><span>${o.name}</span><span>${roleLabel}</span><span>${side}</span><span>${statusLabel}</span><span>${powerLabel}</span><span>${mil.troops}</span><span>${mil.morale}</span><span>${mil.stamina}</span><span>${locLabel}</span></div>`;
      })
      .join("");
    rosterBody.innerHTML = header + rows;
  }

  function setPauseUi(): void {
    btnPause.textContent = pauseActive ? t("header.resume") : t("header.pause");
    btnPause.classList.toggle("active", pauseActive);
  }

  function syncTimeScaleUi(): void {
    if (scheduler) {
      const v = Math.min(4, Math.max(1, Math.round(scheduler.timeScale))) as 1 | 2 | 3 | 4;
      scheduler.timeScale = v;
      timeScaleSlider.value = String(v);
    }
    timeScaleValueEl.textContent = `${timeScaleSlider.value}×`;
  }

  function redraw(): void {
    renderer.resizeToDisplaySize();
    renderer.drawFrame();
  }

  function openContextMenu(node: MapNode, clientX: number, clientY: number): void {
    contextEl.style.left = `${Math.min(clientX, window.innerWidth - 280)}px`;
    contextEl.style.top = `${Math.min(clientY, window.innerHeight - 240)}px`;

    const isPlayerBase =
      (node.type === "CITY" || node.type === "GATE") && node.ownerId === PLAYER_FACTION_ID;
    const showMayorAndPolicy = node.type === "CITY" && node.ownerId === PLAYER_FACTION_ID;
    const mayorOptions = Object.values(gameState.officers)
      .filter(
        (o) =>
          o.ownerId === PLAYER_FACTION_ID &&
          o.status === "IDLE" &&
          o.locationId === node.id,
      )
      .map((o) => `<option value="${o.id}">${o.name}</option>`)
      .join("");

    const mayorSelect =
      `<select id="ctx-mayor" class="ctx-select">
        <option value="">${t("context.mayorNone")}</option>${mayorOptions}
      </select>`;

    contextEl.innerHTML = `
      <h3>${node.name}</h3>
      <div class="context-row"><span>${t("context.defense")}</span><span>${Math.round(node.defense)} / ${Math.round(node.maxDefense)}</span></div>
      <div class="context-row"><span>${t("context.gold")}</span><span>${Math.round(node.resources.gold)}</span></div>
      <div class="context-row"><span>${t("context.food")}</span><span>${Math.round(node.resources.food)}</span></div>
      <div class="context-row"><span>${t("context.troops")}</span><span>${Math.round(node.resources.troops)}</span></div>
      ${
        isPlayerBase
          ? `<div class="context-actions">
          ${
            showMayorAndPolicy
              ? `<label><span>${t("context.mayor")}</span>${mayorSelect}</label>
          <div class="policy-row">
            <button type="button" class="glass-button" data-policy="POLICY_FOCUS_GOLD">${t("policy.gold")}</button>
            <button type="button" class="glass-button" data-policy="POLICY_FOCUS_FOOD">${t("policy.food")}</button>
            <button type="button" class="glass-button" data-policy="POLICY_FOCUS_DRAFT">${t("policy.draft")}</button>
            <button type="button" class="glass-button" data-policy="POLICY_BALANCED">${t("policy.balanced")}</button>
          </div>`
              : ""
          }
          <button type="button" class="glass-button" id="ctx-dispatch">${t("context.dispatch")}</button>
        </div>`
          : `<p class="context-viewonly">${t("context.viewOnly")}</p>`
      }
    `;
    contextEl.classList.add("visible");

    const mayorSel = document.querySelector<HTMLSelectElement>("#ctx-mayor");
    if (mayorSel && showMayorAndPolicy && node.mayorId) {
      mayorSel.value = node.mayorId;
    }
    if (mayorSel && showMayorAndPolicy) {
      mayorSel.addEventListener("change", () => {
        const v = mayorSel.value;
        node.mayorId = v === "" ? null : v;
      });
    }

    for (const btn of contextEl.querySelectorAll<HTMLButtonElement>("[data-policy]")) {
      btn.addEventListener("click", () => {
        node.policy = btn.dataset.policy as CityPolicy;
      });
    }

    const dispatchBtn = document.querySelector<HTMLButtonElement>("#ctx-dispatch");
    dispatchBtn?.addEventListener("click", () => {
      if (!isPlayerBase) return;
      openDispatchModal(node.id);
    });
  }

  function closeContextMenu(): void {
    contextEl.classList.remove("visible");
  }

  function fillDispatchForm(fromCityId: string): void {
    dispatchFromNodeId = fromCityId;
    const city = gameState.nodes[fromCityId];
    const officers = Object.values(gameState.officers).filter(
      (o) => o.ownerId === PLAYER_FACTION_ID && o.locationId === fromCityId && o.status === "IDLE",
    );
    const options = officers.map((o) => `<option value="${o.id}">${o.name}</option>`).join("");
    const empty = `<option value="">${t("dispatch.select")}</option>`;
    dispatchCommander.innerHTML = empty + options;
    refreshDeputyOptions();

    dispatchTarget.innerHTML = Object.values(gameState.nodes)
      .filter((n) => n.id !== fromCityId)
      .map((n) => `<option value="${n.id}">${n.name}</option>`)
      .join("");

    const maxFood = Math.floor(city?.resources.food ?? 0);
    const maxTroops = Math.floor(city?.resources.troops ?? 0);
    dispatchFood.max = String(Math.max(0, maxFood));
    dispatchTroops.max = String(Math.max(1, maxTroops));
    dispatchHint.textContent = t("dispatch.hint", { maxT: maxTroops, maxF: maxFood });
  }

  function refreshDeputyOptions(): void {
    if (!dispatchFromNodeId) return;
    const cmd = dispatchCommander.value;
    const officers = Object.values(gameState.officers).filter(
      (o) =>
        o.ownerId === PLAYER_FACTION_ID &&
        o.locationId === dispatchFromNodeId &&
        o.status === "IDLE" &&
        o.id !== cmd,
    );
    const opts = officers.map((o) => `<option value="${o.id}">${o.name}</option>`).join("");
    const none = `<option value="">${t("context.mayorNone")}</option>`;
    const keep1 = dispatchDeputy1.value;
    const keep2 = dispatchDeputy2.value;
    dispatchDeputy1.innerHTML = none + opts;
    dispatchDeputy2.innerHTML = none + opts;
    if (keep1 && keep1 !== cmd && officers.some((o) => o.id === keep1)) {
      dispatchDeputy1.value = keep1;
    }
    if (keep2 && keep2 !== cmd && keep2 !== dispatchDeputy1.value && officers.some((o) => o.id === keep2)) {
      dispatchDeputy2.value = keep2;
    }
  }

  dispatchCommander.addEventListener("change", () => {
    refreshDeputyOptions();
  });

  function openDispatchModal(fromCityId: string): void {
    fillDispatchForm(fromCityId);
    backdrop.classList.add("visible");
    backdrop.setAttribute("aria-hidden", "false");
  }

  function closeDispatchModal(): void {
    backdrop.classList.remove("visible");
    backdrop.setAttribute("aria-hidden", "true");
    dispatchFromNodeId = null;
  }

  function readDeputies(): string[] {
    const a = dispatchDeputy1.value;
    const b = dispatchDeputy2.value;
    const cmd = dispatchCommander.value;
    const out: string[] = [];
    if (a && a !== cmd) out.push(a);
    if (b && b !== cmd && b !== a) out.push(b);
    return out.slice(0, 2);
  }

  function startGameFromTitle(): void {
    if (gameStarted) return;
    gameStarted = true;
    gameEndShown = false;
    hideGameEndOverlay();
    titleOverlay.classList.add("hidden");
    scheduler = new SimulationScheduler(
      engine,
      gameState,
      (tick) => {
        void (async () => {
          if (tick > 0 && tick % TICKS_PER_MONTH === 0) {
            try {
              await exportGameState(gameState, engine.captureRegistrySnapshot());
            } catch {
              /* silent autosave failure */
            }
          }
        })();
      },
      () => {
        redraw();
        refreshHeader();
        refreshOfficerRoster();
        if (!gameEndShown && isPlayerVictorious(gameState)) {
          gameEndShown = true;
          pauseActive = true;
          if (scheduler) scheduler.paused = true;
          setPauseUi();
          showGameEnd("victory");
        } else if (!gameEndShown && isPlayerDefeated(gameState)) {
          gameEndShown = true;
          pauseActive = true;
          if (scheduler) scheduler.paused = true;
          setPauseUi();
          showGameEnd("defeat");
        }
      },
    );
    timeScaleSlider.disabled = false;
    setPauseUi();
    syncTimeScaleUi();
    scheduler.start();
  }

  dispatchConfirm.addEventListener("click", () => {
    if (!dispatchFromNodeId) return;
    const commander = dispatchCommander.value;
    if (!commander) {
      alert(t("alert.needCommander"));
      return;
    }
    const deputies = readDeputies();
    const total = Math.floor(Number(dispatchTroops.value) || 0);
    const food = Math.floor(Number(dispatchFood.value) || 0);
    const target = dispatchTarget.value;
    const plan = findDispatchRoutePlan(
      gameState,
      dispatchFromNodeId,
      target,
      new Set(gameState.revealedRouteIds),
    );
    if (!plan) {
      alert(t("alert.noRoute"));
      return;
    }
    try {
      dispatchArmyFromCity(gameState, engine, {
        armyId: nextArmyId(),
        fromCityId: dispatchFromNodeId,
        commanderId: commander,
        deputyIds: deputies,
        troops: { cavalry: 0, infantry: total, archer: 0 },
        carriedFood: food,
        pathQueue: plan.pathQueue,
        currentRouteId: plan.currentRouteId,
        targetNodeId: target,
      });
      void assets.preloadFromGameState(gameState);
      closeDispatchModal();
      closeContextMenu();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  });

  dispatchCancel.addEventListener("click", closeDispatchModal);

  titleOverlay.addEventListener("click", () => {
    startGameFromTitle();
  });

  canvas.addEventListener("click", (ev) => {
    if (!gameStarted) return;
    // 忽略攝影機拖曳結束後的 click 事件
    if (renderer.camera.isDragging) return;
    const node = renderer.pickNodeAt(ev.clientX, ev.clientY);
    if (node) {
      ev.stopPropagation();
      openContextMenu(node, ev.clientX, ev.clientY);
    } else {
      closeContextMenu();
    }
  });

  contextEl.addEventListener("click", (ev) => {
    ev.stopPropagation();
  });

  backdrop.addEventListener("click", (ev) => {
    if (ev.target === backdrop) {
      closeDispatchModal();
    }
  });

  backdrop.querySelector(".dispatch-modal")?.addEventListener("click", (ev) => {
    ev.stopPropagation();
  });

  document.addEventListener("click", () => {
    if (!gameStarted) return;
    closeContextMenu();
  });

  btnPause.addEventListener("click", () => {
    if (!scheduler) return;
    pauseActive = !pauseActive;
    scheduler.paused = pauseActive;
    if (pauseActive) {
      scheduler.resetTiming();
    }
    setPauseUi();
    syncTimeScaleUi();
  });

  timeScaleSlider.addEventListener("input", () => {
    if (!scheduler) return;
    pauseActive = false;
    scheduler.paused = false;
    const raw = Number(timeScaleSlider.value);
    const v = (raw < 1 ? 1 : raw > 4 ? 4 : raw) as 1 | 2 | 3 | 4;
    scheduler.timeScale = v;
    timeScaleSlider.value = String(v);
    scheduler.resetTiming();
    setPauseUi();
    syncTimeScaleUi();
  });

  rosterToggle.addEventListener("click", () => {
    officerRosterEl.classList.toggle("collapsed");
    persistRosterCollapsed(officerRosterEl.classList.contains("collapsed"));
    syncRosterPanelChrome();
  });

  btnLoad.addEventListener("click", () => {
    void (async () => {
      const payload = await importGameState();
      if (!payload) {
        alert(t("alert.noSave"));
        return;
      }
      replaceGameStateInPlace(gameState, payload.gameState);
      engine.restoreRegistrySnapshot(payload.registries);
      gameEndShown = false;
      hideGameEndOverlay();
      await assets.preloadFromGameState(gameState);
      closeContextMenu();
      closeDispatchModal();
      if (isPlayerVictorious(gameState)) {
        gameEndShown = true;
        pauseActive = true;
        if (scheduler) scheduler.paused = true;
        setPauseUi();
        showGameEnd("victory");
      } else if (isPlayerDefeated(gameState)) {
        gameEndShown = true;
        pauseActive = true;
        if (scheduler) scheduler.paused = true;
        setPauseUi();
        showGameEnd("defeat");
      }
      refreshHeader();
      refreshOfficerRoster();
      syncTimeScaleUi();
      redraw();
    })();
  });

  localeSwitch.addEventListener("change", () => {
    const v = localeSwitch.value as LocaleId;
    setLocale(v);
  });

  subscribeLocale(() => {
    applyI18nToElements();
    refreshHeader();
    refreshOfficerRoster();
    setPauseUi();
    syncTimeScaleUi();
    redraw();
  });

  window.addEventListener("resize", () => {
    redraw();
  });

  const flagManifest = {
    "faction-flag-FAC_SHU": "/assets/nodes/flag-fac-shu.svg",
    "faction-flag-FAC_ENEMY": "/assets/nodes/flag-fac-enemy.svg",
  };

  void Promise.all([
    assets.preloadManifest(flagManifest),
    assets.preloadFromGameState(gameState),
  ]).then(() => {
    applyI18nToElements();
    refreshHeader();
    refreshOfficerRoster();
    setPauseUi();
    syncTimeScaleUi();
    redraw();
  });
}

mountApp();
