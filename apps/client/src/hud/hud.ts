import type { Crash, GameState } from '../sim';
import { requireElement } from './dom';

function crashReason(crash: Crash | null): string {
  if (crash === null) {
    return '';
  }
  switch (crash.kind) {
    case 'low_barrier':
      return 'Hit a low barrier. That one needed a jump.';
    case 'high_barrier':
      return 'Hit a high barrier. That one needed a roll.';
    case 'train':
      return 'Hit a train. That one needed a different lane.';
  }
}

/** The on-screen readouts. It only reads state; it never changes a run. */
export class Hud {
  private readonly score: HTMLElement;
  private readonly coins: HTMLElement;
  private readonly distance: HTMLElement;
  private readonly speed: HTMLElement;
  private readonly seed: HTMLElement;

  private readonly gameOver: HTMLElement;
  private readonly gameOverReason: HTMLElement;
  private readonly finalScore: HTMLElement;
  private readonly finalCoins: HTMLElement;
  private readonly finalDistance: HTMLElement;
  private readonly restartButton: HTMLButtonElement;

  private readonly fatal: HTMLElement;
  private readonly fatalMessage: HTMLElement;

  constructor(document: Document) {
    this.score = requireElement(document, '#score', HTMLElement);
    this.coins = requireElement(document, '#coins', HTMLElement);
    this.distance = requireElement(document, '#distance', HTMLElement);
    this.speed = requireElement(document, '#speed', HTMLElement);
    this.seed = requireElement(document, '#seed', HTMLElement);

    this.gameOver = requireElement(document, '#gameover', HTMLElement);
    this.gameOverReason = requireElement(document, '#gameover-reason', HTMLElement);
    this.finalScore = requireElement(document, '#final-score', HTMLElement);
    this.finalCoins = requireElement(document, '#final-coins', HTMLElement);
    this.finalDistance = requireElement(document, '#final-distance', HTMLElement);
    this.restartButton = requireElement(document, '#restart', HTMLButtonElement);

    this.fatal = requireElement(document, '#fatal', HTMLElement);
    this.fatalMessage = requireElement(document, '#fatal-message', HTMLElement);
  }

  onRestart(handler: () => void): void {
    this.restartButton.addEventListener('click', handler);
  }

  update(state: GameState, score: number, seed: number): void {
    this.score.textContent = String(score);
    this.coins.textContent = String(state.coinsCollected);
    this.distance.textContent = `${String(Math.floor(state.distance))} m`;
    this.speed.textContent = `${state.speed.toFixed(1)} m/s`;
    this.seed.textContent = `seed ${String(seed)}`;
  }

  showGameOver(state: GameState, score: number): void {
    this.gameOverReason.textContent = crashReason(state.crash);
    this.finalScore.textContent = String(score);
    this.finalCoins.textContent = String(state.coinsCollected);
    this.finalDistance.textContent = `${String(Math.floor(state.distance))} m`;
    this.gameOver.hidden = false;
  }

  hideGameOver(): void {
    this.gameOver.hidden = true;
  }

  /** Shows an error over everything else. Nothing here tries to recover. */
  showFatal(message: string): void {
    this.fatalMessage.textContent = message;
    this.fatal.hidden = false;
  }
}
