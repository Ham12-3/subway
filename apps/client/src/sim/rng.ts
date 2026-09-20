/**
 * mulberry32 as a pure function: the generator state is passed in and handed
 * back, so it can live inside the game state and a run can be replayed exactly.
 */
export interface RandomDraw {
  readonly value: number;
  readonly state: number;
}

export function nextRandom(state: number): RandomDraw {
  const a = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, state: a >>> 0 };
}

/** A whole number in [0, count). */
export function nextRandomBelow(state: number, count: number): RandomDraw {
  if (!Number.isInteger(count) || count <= 0) {
    throw new Error(`nextRandomBelow() needs a positive whole count, received ${String(count)}`);
  }
  const draw = nextRandom(state);
  return { value: Math.floor(draw.value * count), state: draw.state };
}

/**
 * Threads the generator state through a series of draws. The callback is the
 * only place that mutates, and only a local variable, so callers stay pure.
 */
export class RandomStream {
  private current: number;

  constructor(state: number) {
    this.current = state;
  }

  /** A float in [0, 1). */
  next(): number {
    const draw = nextRandom(this.current);
    this.current = draw.state;
    return draw.value;
  }

  /** True with the given probability. */
  chance(probability: number): boolean {
    return this.next() < probability;
  }

  /** A whole number in [0, count). */
  below(count: number): number {
    const draw = nextRandomBelow(this.current, count);
    this.current = draw.state;
    return draw.value;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error('RandomStream.pick() needs at least one item');
    }
    const item = items[this.below(items.length)];
    if (item === undefined) {
      throw new Error('RandomStream.pick() drew an index that does not exist');
    }
    return item;
  }

  get state(): number {
    return this.current;
  }
}
