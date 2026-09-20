import { config, FIXED_DT } from '@lane-runner/shared';

export interface LoopHandlers {
  /** One simulation tick. Always exactly FIXED_DT seconds of game time. */
  fixedUpdate: () => void;
  /**
   * Draws a frame. `alpha` is how far the clock has run past the last tick,
   * from 0 to 1, for smoothing the drawing between ticks.
   */
  render: (alpha: number, frameSeconds: number) => void;
}

/**
 * Fixed-timestep game loop: the simulation always advances in whole ticks of
 * the same size, however fast or slow the display is. A frame longer than
 * `render.maxFrameSeconds` (an alt-tab, a stall) is clamped, so the loop
 * catches up with a bounded number of ticks instead of spiralling.
 */
export function startLoop(handlers: LoopHandlers): () => void {
  let previous = performance.now();
  let accumulator = 0;
  let frame = 0;

  const onFrame = (now: number): void => {
    const elapsed = Math.min((now - previous) / 1000, config.render.maxFrameSeconds);
    previous = now;
    accumulator += elapsed;

    while (accumulator >= FIXED_DT) {
      handlers.fixedUpdate();
      accumulator -= FIXED_DT;
    }

    handlers.render(accumulator / FIXED_DT, elapsed);
    frame = requestAnimationFrame(onFrame);
  };

  frame = requestAnimationFrame(onFrame);
  return () => {
    cancelAnimationFrame(frame);
  };
}
