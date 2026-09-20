import { z } from 'zod';

/**
 * Every tunable number in the game lives here. Game code reads from `config`;
 * it never hard-codes a number of its own.
 *
 * Distances are metres, times are seconds, speeds are metres per second.
 * Spawner gaps are given in seconds and converted to metres at `sim.maxSpeed`,
 * so a gap that is comfortable at top speed is comfortable at any speed.
 */
const rawConfig = {
  sim: {
    ticksPerSecond: 60,
    laneCount: 3,
    laneWidth: 2.4,
    playerStartLane: 1,
    playerLength: 1,
    startSpeed: 11,
    maxSpeed: 24,
    acceleration: 0.22,
    jumpSeconds: 0.62,
    rollSeconds: 0.5,
    scorePerMetre: 1,
    scorePerCoin: 5,
  },
  spawner: {
    /** Empty run-up before the first obstacle row. */
    startClearSeconds: 2.5,
    /** Distance between obstacle rows, as travel time at max speed. */
    minRowGapSeconds: 1,
    maxRowGapSeconds: 1.9,
    /** Slack the gap must leave on top of the longest jump or roll. */
    reactionMarginSeconds: 0.3,
    /** How far ahead of the player the course is generated. */
    spawnAheadSeconds: 6,
    despawnBehindMetres: 30,
    trainLength: 20,
    barrierLength: 1.4,
    /** Chance the guaranteed-safe lane moves sideways at a row. */
    corridorShiftChance: 0.45,
    /** Chance the safe lane holds a barrier that must be jumped or rolled. */
    corridorObstacleChance: 0.4,
    /** Chance any other lane holds an obstacle at a row. */
    obstacleChancePerLane: 0.55,
    /** Share of those obstacles that are trains rather than barriers. */
    trainShare: 0.35,
    /** Share of barriers that are high (roll) rather than low (jump). */
    highBarrierShare: 0.5,
    coinTrailChance: 0.5,
    coinTrailMaxCoins: 6,
    coinSpacingMetres: 3.5,
    coinTrailStartOffsetMetres: 6,
    coinTrailEndMarginMetres: 4,
  },
  render: {
    /** Longest frame the loop will simulate, to stop a stall snowballing. */
    maxFrameSeconds: 0.25,
    cameraBackMetres: 10,
    cameraHeightMetres: 6,
    cameraLookAheadMetres: 16,
    cameraFieldOfView: 58,
    fogNearMetres: 60,
    fogFarMetres: 190,
    /** How quickly the drawn player catches up with its lane. Visual only. */
    laneEasePerSecond: 16,
    jumpArcHeightMetres: 1.9,
    groundStripeSpacingMetres: 6,
    groundStripeCount: 40,
  },
} as const;

const finitePositive = () => z.number().finite().positive();
const finiteNonNegative = () => z.number().finite().nonnegative();
const chance = () => z.number().min(0).max(1);

const configSchema = z
  .object({
    sim: z.object({
      ticksPerSecond: z.number().int().positive(),
      laneCount: z.literal(3),
      laneWidth: finitePositive(),
      playerStartLane: z.number().int().min(0).max(2),
      playerLength: finitePositive(),
      startSpeed: finitePositive(),
      maxSpeed: finitePositive(),
      acceleration: finitePositive(),
      jumpSeconds: finitePositive(),
      rollSeconds: finitePositive(),
      scorePerMetre: finiteNonNegative(),
      scorePerCoin: finiteNonNegative(),
    }),
    spawner: z.object({
      startClearSeconds: finitePositive(),
      minRowGapSeconds: finitePositive(),
      maxRowGapSeconds: finitePositive(),
      reactionMarginSeconds: finiteNonNegative(),
      spawnAheadSeconds: finitePositive(),
      despawnBehindMetres: finitePositive(),
      trainLength: finitePositive(),
      barrierLength: finitePositive(),
      corridorShiftChance: chance(),
      corridorObstacleChance: chance(),
      obstacleChancePerLane: chance(),
      trainShare: chance(),
      highBarrierShare: chance(),
      coinTrailChance: chance(),
      coinTrailMaxCoins: z.number().int().nonnegative(),
      coinSpacingMetres: finitePositive(),
      coinTrailStartOffsetMetres: finitePositive(),
      coinTrailEndMarginMetres: finitePositive(),
    }),
    render: z.object({
      maxFrameSeconds: finitePositive(),
      cameraBackMetres: finitePositive(),
      cameraHeightMetres: finitePositive(),
      cameraLookAheadMetres: finitePositive(),
      cameraFieldOfView: finitePositive(),
      fogNearMetres: finitePositive(),
      fogFarMetres: finitePositive(),
      laneEasePerSecond: finitePositive(),
      jumpArcHeightMetres: finitePositive(),
      groundStripeSpacingMetres: finitePositive(),
      groundStripeCount: z.number().int().positive(),
    }),
  })
  .superRefine((value, ctx) => {
    const fail = (message: string) => {
      ctx.addIssue({ code: 'custom', message });
    };

    const { sim, spawner, render } = value;
    const metresPerTick = sim.maxSpeed / sim.ticksPerSecond;
    const minRowGapMetres = spawner.minRowGapSeconds * sim.maxSpeed;
    const longestMove = Math.max(sim.jumpSeconds, sim.rollSeconds);

    if (sim.maxSpeed <= sim.startSpeed) {
      fail('sim.maxSpeed must be greater than sim.startSpeed');
    }
    if (spawner.maxRowGapSeconds < spawner.minRowGapSeconds) {
      fail('spawner.maxRowGapSeconds must be at least spawner.minRowGapSeconds');
    }
    if (spawner.barrierLength <= metresPerTick) {
      fail(
        `spawner.barrierLength (${String(spawner.barrierLength)}m) must exceed the ` +
          `${metresPerTick.toFixed(3)}m the player covers in one tick, or it can be passed through`,
      );
    }
    if (spawner.trainLength >= minRowGapMetres) {
      fail(
        `spawner.trainLength (${String(spawner.trainLength)}m) must be shorter than the smallest ` +
          `row gap (${minRowGapMetres.toFixed(1)}m), or obstacle rows overlap`,
      );
    }
    if (spawner.minRowGapSeconds < longestMove + spawner.reactionMarginSeconds) {
      fail(
        `spawner.minRowGapSeconds (${String(spawner.minRowGapSeconds)}s) must leave room for the ` +
          `longest jump or roll (${String(longestMove)}s) plus spawner.reactionMarginSeconds`,
      );
    }
    const trailLength = spawner.coinTrailStartOffsetMetres + spawner.coinTrailEndMarginMetres;
    if (trailLength >= minRowGapMetres) {
      fail('spawner coin trail offsets must fit inside the smallest row gap');
    }
    // Coin trails only ever run down the safe lane, which never holds a train,
    // but it can hold a barrier at the row the trail starts from.
    if (spawner.coinTrailStartOffsetMetres <= spawner.barrierLength) {
      fail('spawner.coinTrailStartOffsetMetres must clear a barrier placed at the same row');
    }
    if (render.fogFarMetres <= render.fogNearMetres) {
      fail('render.fogFarMetres must be greater than render.fogNearMetres');
    }
  });

export const config = configSchema.parse(rawConfig);

export type Config = typeof config;

/** Seconds simulated by one tick. The loop never uses any other value. */
export const FIXED_DT = 1 / config.sim.ticksPerSecond;

/** Centre of a lane on the x axis, with lane 1 at x = 0. */
export function laneCentreX(lane: number): number {
  return (lane - (config.sim.laneCount - 1) / 2) * config.sim.laneWidth;
}
