import { config } from '@lane-runner/shared';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { solveCourse, solveFrom, ticksForSeconds } from './__tests__/solver';
import { createInitialState } from './step';
import type { Lane, Obstacle, ObstacleKind } from './types';

const LANES: readonly Lane[] = [0, 1, 2];

/** Obstacles grouped by the row they were placed at. */
function rowsOf(obstacles: readonly Obstacle[]): Map<number, Obstacle[]> {
  const rows = new Map<number, Obstacle[]>();
  for (const obstacle of obstacles) {
    const row = rows.get(obstacle.zStart);
    if (row === undefined) {
      rows.set(obstacle.zStart, [obstacle]);
    } else {
      row.push(obstacle);
    }
  }
  return rows;
}

function kindsInRow(row: readonly Obstacle[]): (ObstacleKind | null)[] {
  return LANES.map((lane) => row.find((obstacle) => obstacle.lane === lane)?.kind ?? null);
}

describe('spawner patterns', () => {
  it('never blocks all three lanes with trains', () => {
    for (let seed = 0; seed < 200; seed += 1) {
      const state = createInitialState(seed);
      for (const [rowZ, row] of rowsOf(state.obstacles)) {
        const trains = row.filter((obstacle) => obstacle.kind === 'train').length;
        expect(trains, `seed ${String(seed)}, row at ${rowZ.toFixed(1)}m`).toBeLessThan(
          config.sim.laneCount,
        );
      }
    }
  });

  it('always leaves a lane that is empty or clearable by one action', () => {
    for (let seed = 0; seed < 200; seed += 1) {
      const state = createInitialState(seed);
      for (const [rowZ, row] of rowsOf(state.obstacles)) {
        const kinds = kindsInRow(row);
        const passable = kinds.filter((kind) => kind !== 'train');
        expect(passable.length, `seed ${String(seed)}, row at ${rowZ.toFixed(1)}m`).toBeGreaterThan(
          0,
        );
      }
    }
  });

  it('keeps rows far enough apart that obstacles never overlap', () => {
    for (let seed = 0; seed < 100; seed += 1) {
      const state = createInitialState(seed);
      const rowZs = [...rowsOf(state.obstacles).keys()].sort((a, b) => a - b);
      for (let i = 1; i < rowZs.length; i += 1) {
        const gap = (rowZs[i] ?? 0) - (rowZs[i - 1] ?? 0);
        expect(gap).toBeGreaterThanOrEqual(
          config.spawner.minRowGapSeconds * config.sim.maxSpeed - 1e-9,
        );
        expect(gap).toBeGreaterThan(config.spawner.trainLength);
      }
    }
  });

  it('never puts a coin inside an obstacle', () => {
    for (let seed = 0; seed < 100; seed += 1) {
      const state = createInitialState(seed);
      for (const coin of state.coins) {
        const inside = state.obstacles.some(
          (obstacle) =>
            obstacle.lane === coin.lane && coin.z >= obstacle.zStart && coin.z <= obstacle.zEnd,
        );
        expect(inside, `seed ${String(seed)}, coin at ${coin.z.toFixed(1)}m`).toBe(false);
      }
    }
  });

  it('keeps generating course ahead of the player', () => {
    const state = createInitialState(5);
    const ahead = config.spawner.spawnAheadSeconds * config.sim.maxSpeed;
    expect(state.nextRowZ).toBeGreaterThan(state.distance + ahead - 1e-9);
    expect(state.obstacles.length).toBeGreaterThan(0);
  });
});

describe('every generated course can be survived', () => {
  it('holds for random seeds', () => {
    fc.assert(
      fc.property(fc.integer({ min: -2_000_000, max: 2_000_000 }), (seed) => {
        const result = solveCourse(seed, ticksForSeconds(30));
        expect(
          result.survived,
          `seed ${String(seed)} became unsurvivable at tick ${String(result.tick)}, ` +
            `${result.distance.toFixed(1)}m in`,
        ).toBe(true);
      }),
      { numRuns: 25 },
    );
  }, 60_000);

  it('holds for a long run, well past the point where speed tops out', () => {
    const result = solveCourse(20_260_919, ticksForSeconds(180));
    expect(result.survived).toBe(true);
    expect(result.distance).toBeGreaterThan(3000);
  }, 60_000);

  it('the solver really does report an impossible course', () => {
    // Guards the test itself: a solver that always answers "survived" would
    // make the property above meaningless. Three trains abreast cannot be
    // passed by any action, and the spawner must never produce this.
    const base = createInitialState(1);
    const trains: Obstacle[] = LANES.map((lane) => ({
      id: 1000 + lane,
      kind: 'train' as const,
      lane,
      zStart: base.distance + 30,
      zEnd: base.distance + 30 + config.spawner.trainLength,
    }));
    const impossible = solveFrom(
      { ...base, obstacles: trains, coins: [], nextRowZ: base.distance + 100_000 },
      ticksForSeconds(45),
    );
    expect(impossible.survived).toBe(false);
  });
});
