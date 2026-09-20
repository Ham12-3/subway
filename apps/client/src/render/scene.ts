import { config, FIXED_DT, laneCentreX } from '@lane-runner/shared';
import * as THREE from 'three';
import type { Coin, GameState, Obstacle, ObstacleKind } from '../sim';
import { sizes, theme } from './theme';

const TRACK_WIDTH = config.sim.laneWidth * config.sim.laneCount;
const GROUND_LENGTH = config.render.fogFarMetres + 120;
const PLAYER_CENTRE_Y = sizes.playerRadius + sizes.playerBodyHeight / 2;

/**
 * Draws the game. It only ever reads the state it is handed: nothing here
 * changes the run, and the simulation never knows this file exists.
 */
export class SceneRenderer {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;

  private readonly player: THREE.Mesh;
  private readonly ground: THREE.Mesh;
  private readonly rails: THREE.Mesh[] = [];
  private readonly dividers: THREE.Mesh[] = [];
  private readonly stripes: THREE.Mesh[] = [];

  private readonly obstacleViews = new Map<number, THREE.Object3D>();
  private readonly coinViews = new Map<number, THREE.Object3D>();

  private readonly obstacleGeometries: Record<ObstacleKind, THREE.BoxGeometry>;
  private readonly obstacleMaterials: Record<ObstacleKind, THREE.Material>;
  private readonly coinGeometry: THREE.TorusGeometry;
  private readonly coinMaterial: THREE.Material;

  private drawnX: number;
  private elapsed = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.scene.background = new THREE.Color(theme.background);
    this.scene.fog = new THREE.Fog(
      theme.background,
      config.render.fogNearMetres,
      config.render.fogFarMetres,
    );

    this.camera = new THREE.PerspectiveCamera(config.render.cameraFieldOfView, 1, 0.1, 400);
    this.scene.add(this.camera);

    const hemisphere = new THREE.HemisphereLight(theme.skyLight, theme.groundLight, 2.6);
    this.scene.add(hemisphere);
    const key = new THREE.DirectionalLight(theme.keyLight, 2.4);
    key.position.set(-6, 14, -4);
    this.scene.add(key);

    this.ground = new THREE.Mesh(
      new THREE.PlaneGeometry(TRACK_WIDTH + sizes.groundMarginMetres, GROUND_LENGTH),
      new THREE.MeshStandardMaterial({ color: theme.ground, roughness: 1 }),
    );
    this.ground.rotation.x = -Math.PI / 2;
    this.scene.add(this.ground);

    const railGeometry = new THREE.BoxGeometry(sizes.railWidth, sizes.railHeight, GROUND_LENGTH);
    const railMaterial = new THREE.MeshStandardMaterial({ color: theme.rail, roughness: 0.9 });
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(railGeometry, railMaterial);
      rail.position.x = side * (TRACK_WIDTH / 2 + sizes.railWidth / 2);
      rail.position.y = sizes.railHeight / 2;
      this.rails.push(rail);
      this.scene.add(rail);
    }

    // Lines between the lanes, so it is clear which lane an obstacle is in.
    const dividerGeometry = new THREE.BoxGeometry(sizes.dividerWidth, 0.02, GROUND_LENGTH);
    const dividerMaterial = new THREE.MeshStandardMaterial({
      color: theme.laneDivider,
      roughness: 1,
    });
    for (let lane = 1; lane < config.sim.laneCount; lane += 1) {
      const divider = new THREE.Mesh(dividerGeometry, dividerMaterial);
      divider.position.x = laneCentreX(lane) - config.sim.laneWidth / 2;
      divider.position.y = 0.012;
      this.dividers.push(divider);
      this.scene.add(divider);
    }

    // Cross-stripes on the ground: they are re-laid every frame around the
    // player, which is what gives the sense of speed.
    const stripeGeometry = new THREE.BoxGeometry(TRACK_WIDTH, 0.02, sizes.stripeDepth);
    const stripeMaterial = new THREE.MeshStandardMaterial({
      color: theme.groundStripe,
      roughness: 1,
    });
    for (let i = 0; i < config.render.groundStripeCount; i += 1) {
      const stripe = new THREE.Mesh(stripeGeometry, stripeMaterial);
      stripe.position.y = 0.01;
      this.stripes.push(stripe);
      this.scene.add(stripe);
    }

    const laneFill = config.sim.laneWidth * sizes.laneFillRatio;
    this.obstacleGeometries = {
      low_barrier: new THREE.BoxGeometry(
        laneFill,
        sizes.lowBarrierHeight,
        config.spawner.barrierLength,
      ),
      high_barrier: new THREE.BoxGeometry(
        laneFill,
        sizes.highBarrierHeight,
        config.spawner.barrierLength,
      ),
      train: new THREE.BoxGeometry(
        config.sim.laneWidth * sizes.trainFillRatio,
        sizes.trainHeight,
        config.spawner.trainLength,
      ),
    };
    this.obstacleMaterials = {
      low_barrier: new THREE.MeshStandardMaterial({ color: theme.lowBarrier, roughness: 0.6 }),
      high_barrier: new THREE.MeshStandardMaterial({ color: theme.highBarrier, roughness: 0.6 }),
      train: new THREE.MeshStandardMaterial({ color: theme.train, roughness: 0.7 }),
    };

    this.coinGeometry = new THREE.TorusGeometry(sizes.coinRadius, sizes.coinThickness, 10, 20);
    this.coinMaterial = new THREE.MeshStandardMaterial({
      color: theme.coin,
      roughness: 0.35,
      metalness: 0.4,
    });

    this.player = new THREE.Mesh(
      new THREE.CapsuleGeometry(sizes.playerRadius, sizes.playerBodyHeight, 6, 16),
      new THREE.MeshStandardMaterial({ color: theme.player, roughness: 0.45 }),
    );
    this.scene.add(this.player);

    this.drawnX = laneCentreX(config.sim.playerStartLane);
    this.resize();
  }

  resize(): void {
    const canvas = this.renderer.domElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width === 0 || height === 0) {
      return;
    }
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  /** Drops every view. Entity ids start again with each run. */
  reset(): void {
    for (const view of this.obstacleViews.values()) {
      this.scene.remove(view);
    }
    for (const view of this.coinViews.values()) {
      this.scene.remove(view);
    }
    this.obstacleViews.clear();
    this.coinViews.clear();
    this.drawnX = laneCentreX(config.sim.playerStartLane);
  }

  render(state: GameState, alpha: number, frameSeconds: number): void {
    this.elapsed += frameSeconds;

    // Between ticks, carry the player on at the current speed so movement
    // stays smooth on displays that refresh faster than the simulation.
    const z = state.distance + alpha * state.speed * FIXED_DT;

    this.syncObstacles(state.obstacles);
    this.syncCoins(state.coins);
    this.layOutGround(z);
    this.placePlayer(state, z, frameSeconds);

    this.camera.position.set(
      this.drawnX * 0.4,
      config.render.cameraHeightMetres,
      z - config.render.cameraBackMetres,
    );
    this.camera.lookAt(this.drawnX * 0.6, 1.2, z + config.render.cameraLookAheadMetres);

    this.renderer.render(this.scene, this.camera);
  }

  private placePlayer(state: GameState, z: number, frameSeconds: number): void {
    const targetX = laneCentreX(state.lane);
    const ease = Math.min(1, config.render.laneEasePerSecond * frameSeconds);
    this.drawnX += (targetX - this.drawnX) * ease;

    let y = PLAYER_CENTRE_Y;
    let squash = 1;
    if (state.mode === 'jumping') {
      const progress = 1 - state.modeSecondsLeft / config.sim.jumpSeconds;
      y += Math.sin(progress * Math.PI) * config.render.jumpArcHeightMetres;
    } else if (state.mode === 'rolling') {
      squash = 0.5;
      y = PLAYER_CENTRE_Y * squash;
    }

    this.player.scale.set(1, squash, 1);
    this.player.position.set(this.drawnX, y, z);
    this.player.visible = state.status === 'running';
  }

  private layOutGround(z: number): void {
    this.ground.position.z = z + GROUND_LENGTH / 2 - config.render.cameraBackMetres * 2;
    for (const piece of [...this.rails, ...this.dividers]) {
      piece.position.z = this.ground.position.z;
    }

    const spacing = config.render.groundStripeSpacingMetres;
    const first = Math.floor(z / spacing) * spacing - spacing * 2;
    this.stripes.forEach((stripe, index) => {
      stripe.position.z = first + index * spacing;
    });
  }

  private syncObstacles(obstacles: readonly Obstacle[]): void {
    syncViews(this.obstacleViews, obstacles, this.scene, (obstacle) => {
      const mesh = new THREE.Mesh(
        this.obstacleGeometries[obstacle.kind],
        this.obstacleMaterials[obstacle.kind],
      );
      mesh.position.set(laneCentreX(obstacle.lane), obstacleCentreY(obstacle.kind), 0);
      const group = new THREE.Group();
      group.add(mesh);
      return group;
    });

    for (const obstacle of obstacles) {
      const view = this.obstacleViews.get(obstacle.id);
      if (view !== undefined) {
        view.position.z = (obstacle.zStart + obstacle.zEnd) / 2;
      }
    }
  }

  private syncCoins(coins: readonly Coin[]): void {
    syncViews(this.coinViews, coins, this.scene, (coin) => {
      const mesh = new THREE.Mesh(this.coinGeometry, this.coinMaterial);
      mesh.position.set(laneCentreX(coin.lane), sizes.coinHeight, coin.z);
      return mesh;
    });

    const spin = this.elapsed * 4;
    for (const view of this.coinViews.values()) {
      view.rotation.y = spin;
    }
  }

  dispose(): void {
    this.reset();
    this.renderer.dispose();
  }
}

function obstacleCentreY(kind: ObstacleKind): number {
  switch (kind) {
    case 'low_barrier':
      return sizes.lowBarrierHeight / 2;
    case 'high_barrier':
      return sizes.highBarrierBottom + sizes.highBarrierHeight / 2;
    case 'train':
      return sizes.trainHeight / 2;
  }
}

/** Adds a view for anything new, drops views for anything gone. */
function syncViews<T extends { readonly id: number }>(
  views: Map<number, THREE.Object3D>,
  items: readonly T[],
  scene: THREE.Scene,
  create: (item: T) => THREE.Object3D,
): void {
  const live = new Set<number>();
  for (const item of items) {
    live.add(item.id);
    if (!views.has(item.id)) {
      const view = create(item);
      views.set(item.id, view);
      scene.add(view);
    }
  }
  for (const [id, view] of views) {
    if (!live.has(id)) {
      scene.remove(view);
      views.delete(id);
    }
  }
}
