import type { Action } from '@lane-runner/shared';
import { FIXED_DT } from '@lane-runner/shared';
import { describe, expect, it } from 'vitest';
import { indexActions, replay } from './replay';
import type { ScheduledAction } from './replay';
import { createInitialState, step } from './step';

const script: readonly ScheduledAction[] = [
  { tick: 10, action: 'left' },
  { tick: 40, action: 'jump' },
  { tick: 90, action: 'right' },
  { tick: 150, action: 'roll' },
  { tick: 220, action: 'right' },
];

describe('replay', () => {
  it('gives the same run for the same seed and actions', () => {
    const first = replay(1234, script, 600);
    const second = replay(1234, script, 600);
    expect(second).toEqual(first);
  });

  it('matches a run played tick by tick', () => {
    const byTick = indexActions(script);
    let live = createInitialState(1234);
    for (let tick = 0; tick < 600; tick += 1) {
      live = step(live, byTick.get(tick) ?? 'none', FIXED_DT);
    }
    expect(replay(1234, script, 600)).toEqual(live);
  });

  it('agrees at every tick along the way, not just at the end', () => {
    const byTick = indexActions(script);
    let a = createInitialState(99);
    let b = createInitialState(99);
    for (let tick = 0; tick < 400; tick += 1) {
      const action: Action = byTick.get(tick) ?? 'none';
      a = step(a, action, FIXED_DT);
      b = step(b, action, FIXED_DT);
      expect(b, `tick ${String(tick)}`).toEqual(a);
    }
  });

  it('gives a different course for a different seed', () => {
    const a = replay(1, [], 600);
    const b = replay(2, [], 600);
    expect(b.obstacles).not.toEqual(a.obstacles);
  });

  it('changes the run when the actions change', () => {
    const quiet = replay(1234, [], 600);
    const busy = replay(1234, script, 600);
    expect(busy).not.toEqual(quiet);
  });

  it('refuses two actions on the same tick', () => {
    expect(() =>
      indexActions([
        { tick: 5, action: 'left' },
        { tick: 5, action: 'right' },
      ]),
    ).toThrow(/Two actions recorded for tick 5/);
  });
});
