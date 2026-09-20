import type { Action } from '@lane-runner/shared';
import { config } from '@lane-runner/shared';
import type { Lane, PlayerMode } from './types';

export interface PlayerState {
  readonly lane: Lane;
  readonly mode: PlayerMode;
  readonly modeSecondsLeft: number;
}

const LAST_LANE = config.sim.laneCount - 1;

/**
 * Applies an action to the player.
 *
 * Lane changes take effect at once and can be made in mid-air. A jump or roll
 * can only be started while running. An action that cannot be taken, such as
 * moving left from the left lane, leaves the player unchanged; that is a game
 * rule, not a failure.
 */
export function applyAction(player: PlayerState, action: Action): PlayerState {
  switch (action) {
    case 'left':
      return player.lane === 0 ? player : { ...player, lane: (player.lane - 1) as Lane };
    case 'right':
      return player.lane === LAST_LANE ? player : { ...player, lane: (player.lane + 1) as Lane };
    case 'jump':
      return player.mode === 'running'
        ? { lane: player.lane, mode: 'jumping', modeSecondsLeft: config.sim.jumpSeconds }
        : player;
    case 'roll':
      return player.mode === 'running'
        ? { lane: player.lane, mode: 'rolling', modeSecondsLeft: config.sim.rollSeconds }
        : player;
    case 'none':
      return player;
  }
}

/** Counts down a jump or roll and drops back to running when it runs out. */
export function advancePlayerTimers(player: PlayerState, dt: number): PlayerState {
  if (player.mode === 'running') {
    return player;
  }
  const secondsLeft = player.modeSecondsLeft - dt;
  return secondsLeft > 0
    ? { ...player, modeSecondsLeft: secondsLeft }
    : { lane: player.lane, mode: 'running', modeSecondsLeft: 0 };
}
