/** Lane 0 is left, 1 is middle, 2 is right. */
export type Lane = 0 | 1 | 2;

export type PlayerMode = 'running' | 'jumping' | 'rolling';

export type ObstacleKind = 'low_barrier' | 'high_barrier' | 'train';

export type RunStatus = 'running' | 'crashed';

export interface Obstacle {
  readonly id: number;
  readonly kind: ObstacleKind;
  readonly lane: Lane;
  /** Near edge, in metres along the track. */
  readonly zStart: number;
  /** Far edge, in metres along the track. */
  readonly zEnd: number;
}

export interface Coin {
  readonly id: number;
  readonly lane: Lane;
  readonly z: number;
}

export interface Crash {
  readonly tick: number;
  readonly obstacleId: number;
  readonly kind: ObstacleKind;
  readonly lane: Lane;
}

/**
 * The whole run in one value. Everything needed to draw a frame, take a
 * decision, or carry on simulating is in here, so a run is fully described by
 * its seed plus the actions taken on each tick.
 */
export interface GameState {
  readonly seed: number;
  readonly tick: number;
  readonly status: RunStatus;
  /** Seeded generator state, advanced only by the spawner. */
  readonly rngState: number;

  readonly lane: Lane;
  readonly mode: PlayerMode;
  /** Seconds left in the current jump or roll; 0 while running. */
  readonly modeSecondsLeft: number;

  readonly speed: number;
  readonly distance: number;
  readonly coinsCollected: number;

  readonly obstacles: readonly Obstacle[];
  readonly coins: readonly Coin[];

  /** Where the next obstacle row will be placed. */
  readonly nextRowZ: number;
  /** The lane the spawner guarantees a way through at the next row. */
  readonly corridorLane: Lane;
  /** What the most recently placed row put in each lane. */
  readonly lastRowKinds: readonly (ObstacleKind | null)[];
  readonly nextEntityId: number;

  readonly crash: Crash | null;
}
