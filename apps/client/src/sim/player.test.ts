import { config, FIXED_DT } from '@lane-runner/shared';
import { describe, expect, it } from 'vitest';
import { advancePlayerTimers, applyAction } from './player';
import type { PlayerState } from './player';

const running: PlayerState = { lane: 1, mode: 'running', modeSecondsLeft: 0 };

/** Ticks the player stays in a jump or roll before dropping back to running. */
function ticksUntilRunning(start: PlayerState): number {
  let player = start;
  let ticks = 0;
  while (player.mode !== 'running') {
    player = advancePlayerTimers(player, FIXED_DT);
    ticks += 1;
    if (ticks > config.sim.ticksPerSecond * 10) {
      throw new Error(`${start.mode} never ended`);
    }
  }
  return ticks;
}

describe('lane changes', () => {
  it('moves one lane at a time', () => {
    expect(applyAction(running, 'left').lane).toBe(0);
    expect(applyAction(running, 'right').lane).toBe(2);
  });

  it('does nothing at the edges', () => {
    const left: PlayerState = { ...running, lane: 0 };
    const right: PlayerState = { ...running, lane: 2 };
    expect(applyAction(left, 'left')).toEqual(left);
    expect(applyAction(right, 'right')).toEqual(right);
  });

  it('is allowed in mid-air', () => {
    const jumping: PlayerState = { lane: 1, mode: 'jumping', modeSecondsLeft: 0.3 };
    const moved = applyAction(jumping, 'left');
    expect(moved.lane).toBe(0);
    expect(moved.mode).toBe('jumping');
    expect(moved.modeSecondsLeft).toBe(0.3);
  });

  it('leaves the player alone on "none"', () => {
    expect(applyAction(running, 'none')).toEqual(running);
  });
});

describe('jump and roll timing', () => {
  it('stays airborne for the configured time, then lands', () => {
    const jumping = applyAction(running, 'jump');
    expect(jumping.mode).toBe('jumping');
    expect(jumping.modeSecondsLeft).toBe(config.sim.jumpSeconds);

    // The jump lasts the configured time, to within the one tick the timer is
    // rounded to.
    const ticks = ticksUntilRunning(jumping);
    expect(Math.abs(ticks * FIXED_DT - config.sim.jumpSeconds)).toBeLessThanOrEqual(FIXED_DT);
  });

  it('rolls for the configured time, then stands up', () => {
    const rolling = applyAction(running, 'roll');
    expect(rolling.mode).toBe('rolling');
    expect(rolling.modeSecondsLeft).toBe(config.sim.rollSeconds);

    const ticks = ticksUntilRunning(rolling);
    expect(Math.abs(ticks * FIXED_DT - config.sim.rollSeconds)).toBeLessThanOrEqual(FIXED_DT);
  });

  it('lands with the timer cleared', () => {
    let player = applyAction(running, 'jump');
    const ticks = ticksUntilRunning(player);
    for (let tick = 0; tick < ticks; tick += 1) {
      player = advancePlayerTimers(player, FIXED_DT);
    }
    expect(player.mode).toBe('running');
    expect(player.modeSecondsLeft).toBe(0);
  });

  it('holds the jump longer than the roll, as configured', () => {
    const jumpTicks = ticksUntilRunning(applyAction(running, 'jump'));
    const rollTicks = ticksUntilRunning(applyAction(running, 'roll'));
    expect(jumpTicks > rollTicks).toBe(config.sim.jumpSeconds > config.sim.rollSeconds);
  });

  it('ignores a jump or roll that is already under way', () => {
    const jumping = applyAction(running, 'jump');
    const midJump = advancePlayerTimers(jumping, FIXED_DT);
    expect(applyAction(midJump, 'jump')).toEqual(midJump);
    expect(applyAction(midJump, 'roll')).toEqual(midJump);
  });

  it('leaves the timers of a running player alone', () => {
    expect(advancePlayerTimers(running, FIXED_DT)).toEqual(running);
  });
});
