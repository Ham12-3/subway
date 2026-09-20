/**
 * Colours and drawing sizes for the scene. Original artwork: everything is
 * built from plain shapes and flat colours.
 *
 * Gameplay numbers live in the shared config; these only affect how things
 * look, never how the simulation behaves.
 */
export const theme = {
  background: 0x0e1622,
  ground: 0x223142,
  groundStripe: 0x35485f,
  rail: 0x3d5270,
  laneDivider: 0x46617f,
  player: 0x4ad4c4,
  lowBarrier: 0xf2a65a,
  highBarrier: 0xb07ae8,
  train: 0x5a6b82,
  trainRoof: 0x3d4a5c,
  coin: 0xffd34d,
  skyLight: 0x9fb6d8,
  groundLight: 0x1a2536,
  keyLight: 0xf4f8ff,
} as const;

export const sizes = {
  playerRadius: 0.36,
  playerBodyHeight: 0.84,
  lowBarrierHeight: 0.7,
  highBarrierBottom: 1.5,
  highBarrierHeight: 0.5,
  trainHeight: 2.6,
  laneFillRatio: 0.8,
  trainFillRatio: 0.88,
  coinRadius: 0.32,
  coinThickness: 0.1,
  coinHeight: 0.95,
  railWidth: 0.5,
  railHeight: 0.6,
  stripeDepth: 0.35,
  dividerWidth: 0.08,
  groundMarginMetres: 4,
} as const;
