/**
 * A fixed-timestep loop: game logic runs at exactly `stepsPerSecond`
 * (GameMaker's room speed) whatever the monitor's refresh rate, and drawing
 * happens once per animation frame. On a 120 Hz screen that is one step every
 * other frame; on a Chromebook that drops to 40 fps it is sometimes two steps
 * in one frame, so the game keeps real-time speed.
 *
 * If steps take longer than real time allows, the loop gives up catching up
 * after MAX_STEPS_PER_FRAME rather than spiralling: the game slows down
 * instead of freezing the tab.
 */
const MAX_STEPS_PER_FRAME = 4;

export interface LoopStats {
  fps: number; // frames drawn per second
  stepsPerSecond: number;
}

export class GameLoop {
  private raf = 0;
  private last = 0;
  private acc = 0;
  private frames = 0;
  private steps = 0;
  private windowStart = 0;
  readonly stats: LoopStats = { fps: 0, stepsPerSecond: 0 };

  constructor(
    /** One logic step. Return false to stop the loop (the game raised an error). */
    private readonly step: () => boolean,
    private readonly draw: () => void,
    private readonly stepsPerSecond = 60,
  ) {}

  get running() {
    return this.raf !== 0;
  }

  start() {
    if (this.raf) return;
    this.last = performance.now();
    this.windowStart = this.last;
    this.acc = 0;
    const dt = 1000 / this.stepsPerSecond;
    const tick = (now: number) => {
      this.raf = requestAnimationFrame(tick);
      this.acc += Math.min(now - this.last, 250);
      this.last = now;
      let n = 0;
      while (this.acc >= dt && n < MAX_STEPS_PER_FRAME) {
        this.acc -= dt;
        n++;
        this.steps++;
        if (!this.step()) {
          this.draw();
          this.stop();
          return;
        }
      }
      if (n === MAX_STEPS_PER_FRAME) this.acc = 0;
      this.draw();
      this.frames++;
      if (now - this.windowStart >= 500) {
        const secs = (now - this.windowStart) / 1000;
        this.stats.fps = Math.round(this.frames / secs);
        this.stats.stepsPerSecond = Math.round(this.steps / secs);
        this.frames = this.steps = 0;
        this.windowStart = now;
      }
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }
}
