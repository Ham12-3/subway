import { describe, expect, it } from 'vitest';
import { nextRandom, nextRandomBelow, RandomStream } from './rng';

describe('seeded random', () => {
  it('gives the same sequence for the same seed', () => {
    const first = new RandomStream(12345);
    const second = new RandomStream(12345);
    const a = [first.next(), first.next(), first.next()];
    const b = [second.next(), second.next(), second.next()];
    expect(a).toEqual(b);
  });

  it('gives different sequences for different seeds', () => {
    const a = new RandomStream(1).next();
    const b = new RandomStream(2).next();
    expect(a).not.toEqual(b);
  });

  it('stays inside [0, 1)', () => {
    const stream = new RandomStream(99);
    for (let i = 0; i < 1000; i += 1) {
      const value = stream.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('is pure: the same state always gives the same draw', () => {
    const state = 777;
    expect(nextRandom(state)).toEqual(nextRandom(state));
  });

  it('draws whole numbers below the count', () => {
    let state = 42;
    for (let i = 0; i < 500; i += 1) {
      const draw = nextRandomBelow(state, 3);
      expect(Number.isInteger(draw.value)).toBe(true);
      expect(draw.value).toBeGreaterThanOrEqual(0);
      expect(draw.value).toBeLessThan(3);
      state = draw.state;
    }
  });

  it('refuses a count that is not a positive whole number', () => {
    expect(() => nextRandomBelow(1, 0)).toThrow(/positive whole count/);
    expect(() => nextRandomBelow(1, 2.5)).toThrow(/positive whole count/);
  });
});
