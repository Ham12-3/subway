import type { Action } from '@lane-runner/shared';

const ACTION_KEYS: ReadonlyMap<string, Action> = new Map<string, Action>([
  ['ArrowLeft', 'left'],
  ['KeyA', 'left'],
  ['ArrowRight', 'right'],
  ['KeyD', 'right'],
  ['ArrowUp', 'jump'],
  ['KeyW', 'jump'],
  ['Space', 'jump'],
  ['ArrowDown', 'roll'],
  ['KeyS', 'roll'],
]);

/**
 * Turns key presses into at most one action per tick.
 *
 * A press is held until the next tick takes it; a second press before that tick
 * replaces the first, so the most recent intent is the one that lands.
 */
export class KeyboardInput {
  private pending: Action | null = null;
  private restartRequested = false;
  private detach: (() => void) | null = null;

  attach(target: Window): void {
    if (this.detach !== null) {
      throw new Error('KeyboardInput is already attached');
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.repeat) {
        return;
      }
      if (event.code === 'KeyR') {
        this.restartRequested = true;
        return;
      }
      const action = ACTION_KEYS.get(event.code);
      if (action === undefined) {
        return;
      }
      event.preventDefault();
      this.pending = action;
    };

    target.addEventListener('keydown', onKeyDown);
    this.detach = () => {
      target.removeEventListener('keydown', onKeyDown);
    };
  }

  dispose(): void {
    this.detach?.();
    this.detach = null;
  }

  /** The action for this tick, clearing it so it is only used once. */
  takeAction(): Action {
    const action = this.pending;
    this.pending = null;
    return action ?? 'none';
  }

  /** Whether R was pressed since this was last asked. */
  takeRestart(): boolean {
    const requested = this.restartRequested;
    this.restartRequested = false;
    return requested;
  }
}
