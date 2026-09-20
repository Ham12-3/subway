import type { Action } from '@lane-runner/shared';
import { FIXED_DT } from '@lane-runner/shared';
import type { GameState, ScheduledAction } from './sim';
import { createInitialState, score, step } from './sim';

/**
 * One run of the game: the simulation state plus the actions taken, so the run
 * can be replayed exactly from its seed.
 */
export class Run {
  private current: GameState;
  private readonly taken: ScheduledAction[] = [];

  constructor(readonly seed: number) {
    this.current = createInitialState(seed);
  }

  get state(): GameState {
    return this.current;
  }

  get actions(): readonly ScheduledAction[] {
    return this.taken;
  }

  get score(): number {
    return score(this.current);
  }

  get isOver(): boolean {
    return this.current.status === 'crashed';
  }

  /** Advances one tick. Doing nothing is not worth recording. */
  tick(action: Action): void {
    if (action !== 'none') {
      this.taken.push({ tick: this.current.tick, action });
    }
    this.current = step(this.current, action, FIXED_DT);
  }
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 2_147_483_647);
}

/**
 * Reads ?seed= from the URL so a course can be played again. A seed that is
 * there but unusable is an error worth showing, not one to paper over.
 */
export function seedFromLocation(search: string): number | null {
  const raw = new URLSearchParams(search).get('seed');
  if (raw === null) {
    return null;
  }
  const seed = Number(raw);
  if (!Number.isInteger(seed)) {
    throw new Error(`The seed in the URL must be a whole number, but it was "${raw}"`);
  }
  return seed;
}
