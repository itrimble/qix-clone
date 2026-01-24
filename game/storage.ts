/**
 * Storage utilities for persisting game data to localStorage
 */

import { STORAGE_KEY_HIGH_SCORE, STORAGE_KEY_MAX_AREA } from './config';

/**
 * Loads the high score from localStorage
 */
export function loadHighScore(): number {
  try {
    const storedScoreStr = localStorage.getItem(STORAGE_KEY_HIGH_SCORE);
    if (storedScoreStr !== null) {
      const score = parseFloat(storedScoreStr);
      return isNaN(score) ? 0 : score;
    }
  } catch (e) {
    console.error("Error loading high score from localStorage:", e);
  }
  return 0;
}

/**
 * Saves the high score to localStorage if it's a new record
 */
export function saveHighScore(newScore: number): void {
  try {
    const currentHighScore = loadHighScore();
    if (newScore > currentHighScore) {
      localStorage.setItem(STORAGE_KEY_HIGH_SCORE, newScore.toString());
      console.log(`New High Score saved: ${newScore}`);
    }
  } catch (e) {
    console.error("Error saving high score to localStorage:", e);
  }
}

/**
 * Loads the max captured area from localStorage
 */
export function loadMaxArea(): number {
  try {
    const storedAreaStr = localStorage.getItem(STORAGE_KEY_MAX_AREA);
    if (storedAreaStr !== null) {
      const area = parseFloat(storedAreaStr);
      return isNaN(area) ? 0 : area;
    }
  } catch (e) {
    console.error("Error loading max area from localStorage:", e);
  }
  return 0;
}

/**
 * Saves the max captured area to localStorage if it's a new record
 */
export function saveMaxArea(newArea: number): void {
  try {
    const currentMaxArea = loadMaxArea();
    const formattedNewArea = parseFloat(newArea.toFixed(1));

    if (formattedNewArea > currentMaxArea) {
      localStorage.setItem(STORAGE_KEY_MAX_AREA, formattedNewArea.toString());
      console.log(`New Max Area Captured saved: ${formattedNewArea}%`);
    }
  } catch (e) {
    console.error("Error saving max area to localStorage:", e);
  }
}
