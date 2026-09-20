import { config } from '@lane-runner/shared';
import { RandomStream } from './rng';
import type { Coin, GameState, Lane, Obstacle, ObstacleKind } from './types';

const LANES: readonly Lane[] = [0, 1, 2];

const SPAWN_AHEAD_METRES = config.spawner.spawnAheadSeconds * config.sim.maxSpeed;

/**
 * The spawner guarantees a way through by keeping a "corridor": one lane per
 * row that the player can always reach and always get past. The rules are:
 *
 *  1. The corridor moves by at most one lane from row to row, so it is always
 *     one sideways move away.
 *  2. The corridor lane never holds a train, only nothing or a barrier the
 *     player can jump or roll.
 *  3. The corridor cannot move into a lane that held a train at the previous
 *     row, so the sideways move is never blocked part-way.
 *  4. Rows are spaced at least `minRowGapSeconds` apart, which the config
 *     checks is longer than the longest jump or roll plus a reaction margin,
 *     so there is always time to act between rows.
 *
 * Trains are shorter than the smallest row gap, so obstacles from one row never
 * reach into the next and each row can be reasoned about on its own.
 *
 * The property test in spawner.solvable.test.ts checks the outcome of these
 * rules with a solver that shares no logic with this file.
 */
function chooseCorridorLane(
  rng: RandomStream,
  previousCorridor: Lane,
  previousKinds: readonly (ObstacleKind | null)[],
): Lane {
  const reachable = LANES.filter(
    (lane) => Math.abs(lane - previousCorridor) <= 1 && previousKinds[lane] !== 'train',
  );
  if (!reachable.includes(previousCorridor)) {
    throw new Error(
      `Corridor lane ${String(previousCorridor)} held a train at the previous row, ` +
        'which the spawner rules forbid',
    );
  }
  const sideways = reachable.filter((lane) => lane !== previousCorridor);
  if (sideways.length > 0 && rng.chance(config.spawner.corridorShiftChance)) {
    return rng.pick(sideways);
  }
  return previousCorridor;
}

function randomBarrier(rng: RandomStream): ObstacleKind {
  return rng.chance(config.spawner.highBarrierShare) ? 'high_barrier' : 'low_barrier';
}

function buildRowKinds(rng: RandomStream, corridorLane: Lane): (ObstacleKind | null)[] {
  const kinds: (ObstacleKind | null)[] = [null, null, null];
  kinds[corridorLane] = rng.chance(config.spawner.corridorObstacleChance)
    ? randomBarrier(rng)
    : null;
  for (const lane of LANES) {
    if (lane === corridorLane) {
      continue;
    }
    if (!rng.chance(config.spawner.obstacleChancePerLane)) {
      continue;
    }
    kinds[lane] = rng.chance(config.spawner.trainShare) ? 'train' : randomBarrier(rng);
  }
  return kinds;
}

function obstacleLength(kind: ObstacleKind): number {
  return kind === 'train' ? config.spawner.trainLength : config.spawner.barrierLength;
}

/**
 * Generates obstacle rows until the course reaches far enough ahead of the
 * player. Pure: the generator state travels in and out through the game state.
 */
export function spawnAhead(state: GameState): GameState {
  const target = state.distance + SPAWN_AHEAD_METRES;
  if (state.nextRowZ > target) {
    return state;
  }

  const rng = new RandomStream(state.rngState);
  const obstacles: Obstacle[] = [...state.obstacles];
  const coins: Coin[] = [...state.coins];
  let nextEntityId = state.nextEntityId;
  let rowZ = state.nextRowZ;
  let corridorLane = state.corridorLane;
  let lastRowKinds = state.lastRowKinds;

  while (rowZ <= target) {
    corridorLane = chooseCorridorLane(rng, corridorLane, lastRowKinds);
    const kinds = buildRowKinds(rng, corridorLane);

    const gapSeconds =
      config.spawner.minRowGapSeconds +
      rng.next() * (config.spawner.maxRowGapSeconds - config.spawner.minRowGapSeconds);
    const nextRowZ = rowZ + gapSeconds * config.sim.maxSpeed;

    for (const lane of LANES) {
      const kind = kinds[lane];
      if (kind === null || kind === undefined) {
        continue;
      }
      obstacles.push({
        id: nextEntityId++,
        kind,
        lane,
        zStart: rowZ,
        zEnd: rowZ + obstacleLength(kind),
      });
    }

    // Coin trails run down the corridor lane, in the clear stretch between rows.
    if (rng.chance(config.spawner.coinTrailChance)) {
      const lastCoinZ = nextRowZ - config.spawner.coinTrailEndMarginMetres;
      let coinZ = rowZ + config.spawner.coinTrailStartOffsetMetres;
      let placed = 0;
      while (coinZ <= lastCoinZ && placed < config.spawner.coinTrailMaxCoins) {
        coins.push({ id: nextEntityId++, lane: corridorLane, z: coinZ });
        coinZ += config.spawner.coinSpacingMetres;
        placed += 1;
      }
    }

    lastRowKinds = kinds;
    rowZ = nextRowZ;
  }

  return {
    ...state,
    obstacles,
    coins,
    rngState: rng.state,
    nextEntityId,
    nextRowZ: rowZ,
    corridorLane,
    lastRowKinds,
  };
}
