import type { Action } from '@lane-runner/shared';
import { FIXED_DT } from '@lane-runner/shared';
import { createInitialState, step } from './step';
import type { GameState } from './types';

/** An action and the tick it was taken on. A run is its seed plus this list. */
export interface ScheduledAction {
  readonly tick: number;
  readonly action: Action;
}

/**
 * Indexes scheduled actions by tick. Two actions on the same tick is a bug in
 * whatever recorded the run, so it throws rather than quietly dropping one.
 */
export function indexActions(actions: readonly ScheduledAction[]): Map<number, Action> {
  const byTick = new Map<number, Action>();
  for (const { tick, action } of actions) {
    if (byTick.has(tick)) {
      throw new Error(`Two actions recorded for tick ${String(tick)}`);
    }
    byTick.set(tick, action);
  }
  return byTick;
}

/**
 * Re-runs a recorded run. The same seed and the same actions always give the
 * same result, tick for tick.
 */
export function replay(
  seed: number,
  actions: readonly ScheduledAction[],
  ticks: number,
): GameState {
  const byTick = indexActions(actions);
  let state = createInitialState(seed);
  for (let tick = 0; tick < ticks; tick += 1) {
    state = step(state, byTick.get(tick) ?? 'none', FIXED_DT);
  }
  return state;
}
