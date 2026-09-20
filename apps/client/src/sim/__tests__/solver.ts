import { ACTIONS, config, FIXED_DT } from '@lane-runner/shared';
import { findCollision, obstaclesAt } from '../collision';
import type { PlayerState } from '../player';
import { advancePlayerTimers, applyAction } from '../player';
import { advanceWorld, createInitialState } from '../step';
import type { GameState, Lane, Obstacle, PlayerMode } from '../types';

/**
 * Test support: decides whether a generated course can be survived at all.
 *
 * It shares no logic with the spawner. It walks every player state reachable on
 * every tick, using the same action, timer and collision functions the game
 * uses, and reports the first tick where every branch is dead. If the spawner
 * ever lays down an impossible pattern, this finds it.
 *
 * "Survivable" here means survivable by a player who reacts perfectly on every
 * tick. It says nothing about whether a human or Jev would manage it.
 */
export interface SolveResult {
  readonly survived: boolean;
  /** Tick where the last surviving branch died, or the tick it ran to. */
  readonly tick: number;
  readonly distance: number;
}

const LANES: readonly Lane[] = [0, 1, 2];
const MODES: readonly PlayerMode[] = ['running', 'jumping', 'rolling'];

function required<T>(value: T | undefined, what: string): T {
  if (value === undefined) {
    throw new Error(`solver: ${what} is missing`);
  }
  return value;
}

function modeIndex(mode: PlayerMode): number {
  return MODES.indexOf(mode);
}

/**
 * Every player state reachable from the start, with the action transitions
 * between them worked out once. A player state is a lane, a mode and how much
 * of that mode is left, and there are only a couple of hundred of them, so the
 * per-tick work becomes integer lookups instead of object churn.
 */
interface StateTable {
  readonly lanes: Int32Array;
  readonly modes: Int32Array;
  /** transitions[state * ACTIONS.length + action] */
  readonly transitions: Int32Array;
  readonly startIndex: number;
  readonly size: number;
}

function buildStateTable(start: PlayerState): StateTable {
  const indexByKey = new Map<string, number>();
  const states: PlayerState[] = [];

  const add = (player: PlayerState): number => {
    const key = `${String(player.lane)}:${player.mode}:${player.modeSecondsLeft.toFixed(9)}`;
    const seen = indexByKey.get(key);
    if (seen !== undefined) {
      return seen;
    }
    const index = states.length;
    indexByKey.set(key, index);
    states.push(player);
    return index;
  };

  const startIndex = add(start);
  const transitions: number[] = [];

  // `states` grows while this runs; that is the search.
  for (let index = 0; index < states.length; index += 1) {
    const player = required(states[index], `state ${String(index)}`);
    for (let action = 0; action < ACTIONS.length; action += 1) {
      const name = required(ACTIONS[action], `action ${String(action)}`);
      const next = advancePlayerTimers(applyAction(player, name), FIXED_DT);
      transitions[index * ACTIONS.length + action] = add(next);
    }
  }

  return {
    lanes: Int32Array.from(states, (player) => player.lane),
    modes: Int32Array.from(states, (player) => modeIndex(player.mode)),
    transitions: Int32Array.from(transitions),
    startIndex,
    size: states.length,
  };
}

/** Obstacles close enough to the player to matter on this tick. */
function nearbyObstacles(state: GameState): readonly Obstacle[] {
  return LANES.flatMap((lane) => obstaclesAt(state.obstacles, state.distance, lane));
}

export function solveCourse(seed: number, ticks: number): SolveResult {
  return solveFrom(createInitialState(seed), ticks);
}

export function solveFrom(start: GameState, ticks: number): SolveResult {
  const table = buildStateTable({
    lane: start.lane,
    mode: start.mode,
    modeSecondsLeft: start.modeSecondsLeft,
  });

  let world = start;
  let frontier = new Uint8Array(table.size);
  frontier[table.startIndex] = 1;

  // safe[lane * MODES.length + mode] for the tick being checked.
  const safe = new Uint8Array(LANES.length * MODES.length);

  for (let tick = 0; tick < ticks; tick += 1) {
    // The course ahead does not depend on what the player does, so one world
    // timeline serves every branch.
    world = advanceWorld(world, FIXED_DT);
    const near = nearbyObstacles(world);

    for (const lane of LANES) {
      for (let mode = 0; mode < MODES.length; mode += 1) {
        const name = required(MODES[mode], `mode ${String(mode)}`);
        safe[lane * MODES.length + mode] =
          findCollision(near, world.distance, lane, name) === null ? 1 : 0;
      }
    }

    const reached = new Uint8Array(table.size);
    let alive = 0;
    for (let index = 0; index < table.size; index += 1) {
      if (frontier[index] !== 1) {
        continue;
      }
      for (let action = 0; action < ACTIONS.length; action += 1) {
        const next = required(table.transitions[index * ACTIONS.length + action], 'a transition');
        if (reached[next] === 1) {
          continue;
        }
        const lane = required(table.lanes[next], 'a lane');
        const mode = required(table.modes[next], 'a mode');
        if (safe[lane * MODES.length + mode] !== 1) {
          continue;
        }
        reached[next] = 1;
        alive += 1;
      }
    }

    if (alive === 0) {
      return { survived: false, tick: tick + 1, distance: world.distance };
    }
    frontier = reached;
  }

  return { survived: true, tick: ticks, distance: world.distance };
}

/** Ticks needed to cover a stretch of play, for readable test lengths. */
export function ticksForSeconds(seconds: number): number {
  return Math.ceil(seconds * config.sim.ticksPerSecond);
}
