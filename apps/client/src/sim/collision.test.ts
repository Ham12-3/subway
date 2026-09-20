import { config } from '@lane-runner/shared';
import { describe, expect, it } from 'vitest';
import { clearsObstacle, findCollision } from './collision';
import type { Lane, Obstacle, ObstacleKind, PlayerMode } from './types';

function obstacleAt(kind: ObstacleKind, lane: Lane, zStart: number): Obstacle {
  const length = kind === 'train' ? config.spawner.trainLength : config.spawner.barrierLength;
  return { id: 1, kind, lane, zStart, zEnd: zStart + length };
}

/** Every combination of obstacle and player mode, and whether it is a crash. */
const cases: ReadonlyArray<[ObstacleKind, PlayerMode, boolean]> = [
  ['low_barrier', 'running', true],
  ['low_barrier', 'jumping', false],
  ['low_barrier', 'rolling', true],
  ['high_barrier', 'running', true],
  ['high_barrier', 'jumping', true],
  ['high_barrier', 'rolling', false],
  ['train', 'running', true],
  ['train', 'jumping', true],
  ['train', 'rolling', true],
];

describe('collisions', () => {
  it.each(cases)('%s while %s crashes: %s', (kind, mode, crashes) => {
    const obstacles = [obstacleAt(kind, 1, 100)];
    const hit = findCollision(obstacles, 100, 1, mode);
    expect(hit !== null).toBe(crashes);
  });

  it('only hits obstacles in the same lane', () => {
    const obstacles = [obstacleAt('train', 0, 100), obstacleAt('train', 2, 100)];
    expect(findCollision(obstacles, 100, 1, 'running')).toBeNull();
    expect(findCollision(obstacles, 100, 0, 'running')).not.toBeNull();
  });

  it('misses obstacles that are ahead or behind', () => {
    const obstacles = [obstacleAt('low_barrier', 1, 100)];
    const half = config.sim.playerLength / 2;
    const clearAhead = 100 - half - 0.01;
    const clearBehind = 100 + config.spawner.barrierLength + half + 0.01;
    expect(findCollision(obstacles, clearAhead, 1, 'running')).toBeNull();
    expect(findCollision(obstacles, clearBehind, 1, 'running')).toBeNull();
    expect(findCollision(obstacles, 100, 1, 'running')).not.toBeNull();
  });

  it('reports which obstacle was hit', () => {
    const train = obstacleAt('train', 1, 50);
    expect(findCollision([train], 55, 1, 'jumping')?.id).toBe(train.id);
  });

  it('agrees with the mode that clears each obstacle', () => {
    expect(clearsObstacle('low_barrier', 'jumping')).toBe(true);
    expect(clearsObstacle('high_barrier', 'rolling')).toBe(true);
    expect(clearsObstacle('train', 'jumping')).toBe(false);
    expect(clearsObstacle('train', 'rolling')).toBe(false);
  });
});
