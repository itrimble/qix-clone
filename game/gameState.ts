/**
 * Game state management
 */

import { INITIAL_LIVES } from './config';

/**
 * Interface for the game state
 */
export interface GameState {
  score: number;
  lives: number;
  captured: number;
  level: number;
}

/**
 * Creates a new game state with default values
 */
export function createInitialGameState(): GameState {
  return {
    score: 0,
    lives: INITIAL_LIVES,
    captured: 0,
    level: 1
  };
}

/**
 * Resets the game state to initial values
 */
export function resetGameState(gameState: GameState): void {
  gameState.lives = INITIAL_LIVES;
  gameState.score = 0;
  gameState.captured = 0;
  gameState.level = 1;
}

// Cached DOM element references
let scoreElement: HTMLElement | null = null;
let livesElement: HTMLElement | null = null;
let capturedElement: HTMLElement | null = null;

/**
 * Caches DOM element references for HUD updates
 * Call this once during initialization
 */
export function cacheHUDElements(): void {
  scoreElement = document.getElementById('score');
  livesElement = document.getElementById('lives');
  capturedElement = document.getElementById('captured');
}

/**
 * Updates the HUD display with current game state
 */
export function updateHUD(gameState: GameState): void {
  if (scoreElement) scoreElement.textContent = `Score: ${gameState.score}`;
  if (livesElement) livesElement.textContent = `Lives: ${gameState.lives}`;
  if (capturedElement) capturedElement.textContent = `Captured: ${gameState.captured.toFixed(1)}%`;
}
