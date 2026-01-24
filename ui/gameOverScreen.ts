/**
 * Game Over Screen management
 */

import { GameState } from '../game/gameState';
import { loadHighScore, saveHighScore, loadMaxArea, saveMaxArea } from '../game/storage';
import { playSound } from '../sound/sound';

// Cached DOM element references
let gameOverOverlay: HTMLElement | null = null;
let finalScoreEl: HTMLElement | null = null;
let finalAreaEl: HTMLElement | null = null;
let restartButton: HTMLElement | null = null;
let highScoreDisplayEl: HTMLElement | null = null;
let maxAreaDisplayEl: HTMLElement | null = null;
let canvas: HTMLElement | null = null;

/**
 * Caches DOM element references for the game over screen
 * Call this once during initialization
 */
export function cacheGameOverElements(gameCanvas: HTMLElement): void {
  gameOverOverlay = document.getElementById('game-over-overlay');
  finalScoreEl = document.getElementById('final-score');
  finalAreaEl = document.getElementById('final-area');
  restartButton = document.getElementById('restart-button');
  highScoreDisplayEl = document.getElementById('high-score-display');
  maxAreaDisplayEl = document.getElementById('max-area-display');
  canvas = gameCanvas;
}

/**
 * Gets the restart button element
 */
export function getRestartButton(): HTMLElement | null {
  return restartButton;
}

/**
 * Shows the game over screen with final scores
 */
export function showGameOverScreen(gameState: GameState): void {
  saveHighScore(gameState.score);
  saveMaxArea(gameState.captured);
  playSound('gameOver');

  if (gameOverOverlay && finalScoreEl && finalAreaEl && canvas) {
    finalScoreEl.textContent = gameState.score.toString();
    finalAreaEl.textContent = gameState.captured.toFixed(1);

    if (highScoreDisplayEl && maxAreaDisplayEl) {
      const allTimeHighScore = loadHighScore();
      const allTimeMaxArea = loadMaxArea();

      highScoreDisplayEl.textContent = allTimeHighScore.toString();
      maxAreaDisplayEl.textContent = allTimeMaxArea.toFixed(1);

      console.log(`Displayed All-Time High Score: ${allTimeHighScore}, Max Area: ${allTimeMaxArea}%`);
    } else {
      console.error("DOM elements for displaying best stats not found!");
    }

    gameOverOverlay.classList.remove('hidden');
    canvas.classList.add('game-canvas-paused');

    console.log("Game Over Screen Shown. Scores saved (if new records). Best stats displayed.");
  } else {
    console.error("Game Over screen DOM elements not found for showing!");
  }
}

/**
 * Hides the game over screen
 */
export function hideGameOverScreen(): void {
  if (gameOverOverlay && canvas) {
    gameOverOverlay.classList.add('hidden');
    canvas.classList.remove('game-canvas-paused');
    console.log("Game Over Screen Hidden");
  }
}
