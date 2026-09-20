import './style.css';
import { requireElement } from './hud/dom';
import { Hud } from './hud/hud';
import { KeyboardInput } from './input/keyboard';
import { startLoop } from './loop';
import { SceneRenderer } from './render/scene';
import { randomSeed, Run, seedFromLocation } from './run';

function describe(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ?? `${error.name}: ${error.message}`;
  }
  return `Unexpected error: ${String(error)}`;
}

function start(): void {
  const canvas = requireElement(document, '#scene', HTMLCanvasElement);
  const hud = new Hud(document);

  const seed = seedFromLocation(window.location.search) ?? randomSeed();
  let run = new Run(seed);
  let gameOverShown = false;

  const renderer = new SceneRenderer(canvas);
  const input = new KeyboardInput();
  input.attach(window);

  const restart = (): void => {
    run = new Run(randomSeed());
    gameOverShown = false;
    renderer.reset();
    hud.hideGameOver();
  };

  hud.onRestart(restart);
  window.addEventListener('resize', () => {
    renderer.resize();
  });

  startLoop({
    fixedUpdate: () => {
      if (input.takeRestart()) {
        restart();
        return;
      }
      if (run.isOver) {
        if (!gameOverShown) {
          hud.showGameOver(run.state, run.score);
          gameOverShown = true;
        }
        return;
      }
      run.tick(input.takeAction());
    },
    render: (alpha, frameSeconds) => {
      renderer.render(run.state, run.isOver ? 0 : alpha, frameSeconds);
      hud.update(run.state, run.score, run.seed);
    },
  });
}

try {
  start();
} catch (error) {
  // Nothing here tries to carry on: show what went wrong and stop.
  const message = describe(error);
  const fatal = document.querySelector('#fatal');
  const fatalMessage = document.querySelector('#fatal-message');
  if (fatal instanceof HTMLElement && fatalMessage instanceof HTMLElement) {
    fatalMessage.textContent = message;
    fatal.hidden = false;
  }
  throw error;
}
