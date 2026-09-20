import { config } from '@lane-runner/shared';
import type { Lane, Obstacle, ObstacleKind, PlayerMode } from './types';

/** Which player mode, if any, gets past each kind of obstacle. */
export function clearsObstacle(kind: ObstacleKind, mode: PlayerMode): boolean {
  switch (kind) {
    case 'low_barrier':
      return mode === 'jumping';
    case 'high_barrier':
      return mode === 'rolling';
    case 'train':
      return false;
  }
}

const HALF_PLAYER = config.sim.playerLength / 2;

/** Obstacles the player's box overlaps right now, in their own lane. */
export function obstaclesAt(obstacles: readonly Obstacle[], distance: number, lane: Lane) {
  const back = distance - HALF_PLAYER;
  const front = distance + HALF_PLAYER;
  return obstacles.filter((o) => o.lane === lane && front > o.zStart && back < o.zEnd);
}

/**
 * The obstacle the player has hit, or null if they are clear. Both the
 * simulation and the solvability solver go through this one function, so they
 * can never disagree about what counts as a crash.
 */
export function findCollision(
  obstacles: readonly Obstacle[],
  distance: number,
  lane: Lane,
  mode: PlayerMode,
): Obstacle | null {
  for (const obstacle of obstaclesAt(obstacles, distance, lane)) {
    if (!clearsObstacle(obstacle.kind, mode)) {
      return obstacle;
    }
  }
  return null;
}
