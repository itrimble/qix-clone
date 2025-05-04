// Completely revised controls.ts

import * as THREE from 'three';
import { player } from '../game/engine';

// Directly expose the keys object
export const keys: Record<string, boolean> = {};

export function initControls(canvas: HTMLCanvasElement, scene: THREE.Scene, camera: THREE.Camera): void {
  console.log('Initializing controls...');

  // Clear any existing key states
  Object.keys(keys).forEach(key => delete keys[key]);
  
  // Key event handlers with debug
  function handleKeyDown(e: KeyboardEvent) {
    // Store key state - normalize to lowercase for consistency
    const keyLower = e.key.toLowerCase();
    keys[keyLower] = true;
    
    // Also store arrow keys without conversion for backward compatibility
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      keys[e.key] = true;
    }
    
    console.log(`Key down: ${e.key} (${keyLower})`);
    
    // Prevent default for navigation keys
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'w', 'a', 's', 'd'].includes(keyLower)) {
      e.preventDefault();
    }
    
    // Special key handling
    if (keyLower === 'c') {
      toggleCRT();
    } else if (keyLower === 's') {
      toggleSettings();
    }
  }
  
  function handleKeyUp(e: KeyboardEvent) {
    // Clear key state
    const keyLower = e.key.toLowerCase();
    keys[keyLower] = false;
    
    // Also clear arrow keys without conversion for backward compatibility
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      keys[e.key] = false;
    }
    
    console.log(`Key up: ${e.key} (${keyLower})`);
  }
  
  // Remove any existing listeners to prevent duplicates
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('keyup', handleKeyUp);
  
  // Add the listeners
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  
  // Force focus on the canvas to ensure it receives key events
  canvas.tabIndex = 1;
  canvas.focus();
  canvas.addEventListener('click', () => canvas.focus());
  
  // CRT toggle function
  function toggleCRT() {
    const button = document.getElementById('crt-toggle');
    const body = document.body;
    body.classList.toggle('crt');
    
    if (button) {
      button.textContent = body.classList.contains('crt') ? 'CRT: ON' : 'CRT: OFF';
    }
    
    const crtCheckbox = document.getElementById('crtFilter') as HTMLInputElement;
    if (crtCheckbox) {
      crtCheckbox.checked = body.classList.contains('crt');
    }
  }
  
  // Settings toggle function
  function toggleSettings() {
    const modal = document.getElementById('settings-modal');
    if (modal) {
      modal.classList.toggle('hidden');
      
      // If showing, make sure checkboxes reflect current state
      if (!modal.classList.contains('hidden')) {
        const darkModeCheckbox = document.getElementById('darkMode') as HTMLInputElement;
        if (darkModeCheckbox) {
          darkModeCheckbox.checked = document.body.classList.contains('dark-mode');
        }
        
        const crtFilterCheckbox = document.getElementById('crtFilter') as HTMLInputElement;
        if (crtFilterCheckbox) {
          crtFilterCheckbox.checked = document.body.classList.contains('crt');
        }
      }
    }
  }
  
  // Connect UI buttons
  const setupButtons = () => {
    // CRT toggle button
    const crtButton = document.getElementById('crt-toggle');
    if (crtButton) {
      // Remove existing listeners to prevent duplicates
      const newBtn = crtButton.cloneNode(true);
      crtButton.parentNode?.replaceChild(newBtn, crtButton);
      newBtn.addEventListener('click', toggleCRT);
    }
    
    // Settings button
    const settingsButton = document.getElementById('settings-button');
    if (settingsButton) {
      // Remove existing listeners to prevent duplicates
      const newBtn = settingsButton.cloneNode(true);
      settingsButton.parentNode?.replaceChild(newBtn, settingsButton);
      newBtn.addEventListener('click', toggleSettings);
    }
    
    // Close settings button
    const closeSettingsButton = document.getElementById('close-settings');
    if (closeSettingsButton) {
      // Remove existing listeners to prevent duplicates
      const newBtn = closeSettingsButton.cloneNode(true);
      closeSettingsButton.parentNode?.replaceChild(newBtn, closeSettingsButton);
      newBtn.addEventListener('click', toggleSettings);
    }
    
    // Level up button
    const levelUpButton = document.getElementById('level-up');
    if (levelUpButton) {
      // Remove existing listeners to prevent duplicates
      const newBtn = levelUpButton.cloneNode(true);
      levelUpButton.parentNode?.replaceChild(newBtn, levelUpButton);
      newBtn.addEventListener('click', () => {
        console.log('Level up!');
        toggleSettings(); // Close settings when leveling up
      });
    }
    
    console.log('Buttons connected');
  };
  
  // Run setup after a short delay to ensure DOM is ready
  setTimeout(setupButtons, 100);
  
  // Expose keys globally for debugging
  (window as any).gameKeys = keys;
  
  console.log('Controls initialization complete');
}