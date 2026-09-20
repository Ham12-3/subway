import type { Action } from '@lane-runner/shared';
import { config } from '@lane-runner/shared';
import { findCollision } from './collision';
import type { PlayerState } from './player';
import { advancePlayerTimers, applyAction } from './player';
import { spawnAhead } from './spawner';
import type { Coin, GameState, Lane } from './types';

function playerOf(state: GameState): PlayerState {
  return { lane: state.lane, mode: state.mode, modeSecondsLeft: state.modeSecondsLeft };
}

export function createInitialState(seed: number): GameState {
  if (!Number.isInteger(seed)) {
    throw new Error(`createInitialState() needs a whole-number seed, received ${String(seed)}`);
  }
  const startLane = config.sim.playerStartLane as Lane;
  return spawnAhead({
    seed,
    tick: 0,
    status: 'running',
    rngState: seed >>> 0,
    lane: startLane,
    mode: 'running',
    modeSecondsLeft: 0,
    speed: config.sim.startSpeed,
    distance: 0,
    coinsCollected: 0,
    obstacles: [],
    coins: [],
    nextRowZ: config.spawner.startClearSeconds * config.sim.maxSpeed,
    corridorLane: startLane,
    lastRowKinds: [null, null, null],
    nextEntityId: 1,
    crash: null,
  });
}

/**
 * Moves the world on by one step: speed, distance, and the course ahead. None
 * of it depends on what the player does, which is what lets the solvability
 * solver walk the same course the player will meet.
 */
export function advanceWorld(state: GameState, dt: number): GameState {
  const speed = Math.min(config.sim.maxSpeed, state.speed + config.sim.acceleration * dt);
  const distance = state.distance + speed * dt;
  const cutoff = distance - config.spawner.despawnBehindMetres;
  return spawnAhead({
    ...state,
    tick: state.tick + 1,
    speed,
    distance,
    obstacles: state.obstacles.filter((obstacle) => obstacle.zEnd >= cutoff),
    coins: state.coins.filter((coin) => coin.z >= cutoff),
  });
}

/**
 * One tick of the game.
 *
 * A crashed run is final, so stepping it again returns it unchanged. Every
 * other call moves the run on by exactly `dt` seconds.
 */
export function step(state: GameState, action: Action, dt: number): GameState {
  if (!Number.isFinite(dt) || dt <= 0) {
    throw new Error(`step() needs a positive, finite dt, received ${String(dt)}`);
  }
  if (state.status === 'crashed') {
    return state;
  }

  const moved = applyAction(playerOf(state), action);
  const world = advanceWorld(state, dt);
  const player = advancePlayerTimers(moved, dt);

  const half = config.sim.playerLength / 2;
  const back = world.distance - half;
  const front = world.distance + half;
  const remainingCoins: Coin[] = [];
  let collected = 0;
  for (const coin of world.coins) {
    if (coin.lane === player.lane && coin.z >= back && coin.z <= front) {
      collected += 1;
    } else {
      remainingCoins.push(coin);
    }
  }

  const hit = findCollision(world.obstacles, world.distance, player.lane, player.mode);

  return {
    ...world,
    lane: player.lane,
    mode: player.mode,
    modeSecondsLeft: player.modeSecondsLeft,
    coins: remainingCoins,
    coinsCollected: state.coinsCollected + collected,
    status: hit === null ? 'running' : 'crashed',
    crash:
      hit === null
        ? null
        : { tick: world.tick, obstacleId: hit.id, kind: hit.kind, lane: player.lane },
  };
}

export function score(state: GameState): number {
  return (
    Math.floor(state.distance * config.sim.scorePerMetre) +
    state.coinsCollected * config.sim.scorePerCoin
  );
}
