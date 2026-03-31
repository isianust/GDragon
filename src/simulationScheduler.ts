import type { GameState } from "./types.ts";
import type { TickEngine } from "./tickEngine.ts";

/** Real-time pacing: 6× faster than the legacy 5s-per-tick baseline. */
const BASE_MS_PER_TICK = 5000 / 6;

export class SimulationScheduler {
  paused = false;
  timeScale: 1 | 2 | 3 | 4 = 1;

  private accumulatorMs = 0;
  private lastFrameTs = 0;
  private rafId = 0;

  private readonly engine: TickEngine;
  public state: GameState;
  private readonly onSimulationTick: (tick: number) => void;
  private readonly onFrame: () => void;

  constructor(
    engine: TickEngine,
    state: GameState,
    onSimulationTick: (tick: number) => void,
    onFrame: () => void,
  ) {
    this.engine = engine;
    this.state = state;
    this.onSimulationTick = onSimulationTick;
    this.onFrame = onFrame;
  }

  start(): void {
    this.lastFrameTs = 0;
    const loop = (ts: number) => {
      if (!this.lastFrameTs) this.lastFrameTs = ts;
      const dt = ts - this.lastFrameTs;
      this.lastFrameTs = ts;

      if (!this.paused) {
        const step = BASE_MS_PER_TICK / this.timeScale;
        this.accumulatorMs += dt;
        let guard = 0;
        while (this.accumulatorMs >= step && guard++ < 12) {
          this.accumulatorMs -= step;
          const result = this.engine.tick(this.state);
          this.onSimulationTick(result.tick);
        }
      }

      this.onFrame();
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop(): void {
    cancelAnimationFrame(this.rafId);
  }

  resetTiming(): void {
    this.accumulatorMs = 0;
    this.lastFrameTs = 0;
  }
}
