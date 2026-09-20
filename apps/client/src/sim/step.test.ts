import { config, FIXED_DT } from '@lane-runner/shared';
import { describe, expect, it } from 'vitest';
import { advanceWorld, createInitialState, score, step } from './step';
import type { GameState, Obstacle } from './types';

function runTicks(state: GameState, ticks: number, action: 'none' = 'none'): GameState {
  let current = state;
  for (let i = 0; i < ticks; i += 1) {
    current = step(current, action, FIXED_DT);
  }
  return current;
}

/** A state with a hand-placed obstacle and nothing else in the way. */
function stateWithObstacle(obstacle: Obstacle, distance: number): GameState {
  const base = createInitialState(1);
  return {
    ...base,
    distance,
    obstacles: [obstacle],
    coins: [],
    // Push the spawner far away so it does not add anything to this test.
    nextRowZ: distance + 100_000,
  };
}

describe('step', () => {
  it('refuses a dt that is not positive and finite', () => {
    const state = createInitialState(1);
    expect(() => step(state, 'none', 0)).toThrow(/positive, finite dt/);
    expect(() => step(state, 'none', -FIXED_DT)).toThrow(/positive, finite dt/);
    expect(() => step(state, 'none', Number.NaN)).toThrow(/positive, finite dt/);
  });

  it('runs forward on its own', () => {
    const state = createInitialState(7);
    const next = step(state, 'none', FIXED_DT);
    expect(next.distance).toBeGreaterThan(state.distance);
    expect(next.tick).toBe(1);
  });

  it('speeds up over time and stops at the cap', () => {
    const state = createInitialState(3);
    const after1s = runTicks(state, config.sim.ticksPerSecond);
    expect(after1s.speed).toBeCloseTo(config.sim.startSpeed + config.sim.acceleration, 5);
    expect(after1s.status).toBe('running');

    // Long enough to reach the cap, run on the world alone so an obstacle
    // cannot end the run part-way and freeze the speed.
    const secondsToCap =
      (config.sim.maxSpeed - config.sim.startSpeed) / config.sim.acceleration + 5;
    let world = state;
    for (let i = 0; i < Math.ceil(secondsToCap * config.sim.ticksPerSecond); i += 1) {
      world = advanceWorld(world, FIXED_DT);
    }
    expect(world.speed).toBe(config.sim.maxSpeed);
  });

  it('covers more ground per tick as it speeds up', () => {
    let world = createInitialState(3);
    const first = advanceWorld(world, FIXED_DT);
    const firstStep = first.distance - world.distance;

    world = first;
    for (let i = 0; i < config.sim.ticksPerSecond * 10; i += 1) {
      world = advanceWorld(world, FIXED_DT);
    }
    const later = advanceWorld(world, FIXED_DT);
    expect(later.distance - world.distance).toBeGreaterThan(firstStep);
  });

  it('moves between lanes', () => {
    const state = createInitialState(5);
    expect(step(state, 'left', FIXED_DT).lane).toBe(0);
    expect(step(state, 'right', FIXED_DT).lane).toBe(2);
  });

  it('ends the run on a collision and records what was hit', () => {
    const obstacle: Obstacle = {
      id: 42,
      kind: 'train',
      lane: 1,
      zStart: 200,
      zEnd: 200 + config.spawner.trainLength,
    };
    const state = stateWithObstacle(obstacle, 199);
    const crashed = runTicks(state, 10);

    expect(crashed.status).toBe('crashed');
    expect(crashed.crash?.obstacleId).toBe(42);
    expect(crashed.crash?.kind).toBe('train');
  });

  it('leaves a finished run alone', () => {
    const obstacle: Obstacle = { id: 1, kind: 'train', lane: 1, zStart: 200, zEnd: 220 };
    const crashed = runTicks(stateWithObstacle(obstacle, 199), 10);
    expect(crashed.status).toBe('crashed');
    expect(step(crashed, 'jump', FIXED_DT)).toBe(crashed);
  });

  it('gets past a low barrier by jumping and hits it otherwise', () => {
    const obstacle: Obstacle = {
      id: 9,
      kind: 'low_barrier',
      lane: 1,
      zStart: 105,
      zEnd: 105 + config.spawner.barrierLength,
    };
    const start = stateWithObstacle(obstacle, 100);
    const ticksToReach = 30;

    expect(runTicks(start, ticksToReach).status).toBe('crashed');

    const jumped = runTicks(step(start, 'jump', FIXED_DT), ticksToReach - 1);
    expect(jumped.status).toBe('running');
  });

  it('collects coins in the current lane', () => {
    const base = createInitialState(11);
    const state: GameState = {
      ...base,
      obstacles: [],
      coins: [{ id: 1, lane: 1, z: base.distance + 1 }],
      nextRowZ: base.distance + 100_000,
    };
    const after = runTicks(state, 20);
    expect(after.coinsCollected).toBe(1);
    expect(after.coins).toHaveLength(0);
  });

  it('leaves coins in other lanes', () => {
    const base = createInitialState(11);
    const state: GameState = {
      ...base,
      obstacles: [],
      coins: [{ id: 1, lane: 0, z: base.distance + 1 }],
      nextRowZ: base.distance + 100_000,
    };
    expect(runTicks(state, 20).coinsCollected).toBe(0);
  });

  it('scores distance and coins together', () => {
    const base = createInitialState(2);
    const state: GameState = { ...base, distance: 120.9, coinsCollected: 3 };
    expect(score(state)).toBe(
      Math.floor(120.9 * config.sim.scorePerMetre) + 3 * config.sim.scorePerCoin,
    );
  });

  it('refuses a seed that is not a whole number', () => {
    expect(() => createInitialState(1.5)).toThrow(/whole-number seed/);
  });
});
