// Completely revised controls.ts

import * as THREE from 'three';
import { player, saveGameState, toggleC64Mode, triggerGameReset } from '../game/engine'; // Added triggerGameReset

// Directly expose the keys object
export const keys: Record<string, boolean> = {};

// Gamepad state
const gamepads: Record<number, Gamepad> = {};
let gamepadPollInterval: number | undefined;
const previousButtonStates: Record<number, Record<number, boolean>> = {}; // Stores previous state of buttons for each gamepad

// --- Toggle Functions (Refactored) ---
// Moved outside initControls to be accessible by pollGamepads and keyboard handlers

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
    } else if (keyLower === 'p') { 
      saveGameState();
    } else if (keyLower === 'r') { // 'r' for Retro C64 mode
      toggleC64Mode();
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
  
  // Connect UI buttons
  const setupButtons = () => {
    // CRT toggle button
    const crtButton = document.getElementById('crt-toggle');
    if (crtButton) {
      // Remove existing listeners to prevent duplicates
      const newBtn = crtButton.cloneNode(true);
      crtButton.parentNode?.replaceChild(newBtn, crtButton);
      newBtn.addEventListener('click', toggleCRT); // Now calls the refactored function
    }
    
    // Settings button
    const settingsButton = document.getElementById('settings-button');
    if (settingsButton) {
      // Remove existing listeners to prevent duplicates
      const newBtn = settingsButton.cloneNode(true);
      settingsButton.parentNode?.replaceChild(newBtn, settingsButton);
      newBtn.addEventListener('click', toggleSettings); // Now calls the refactored function
    }
    
    // Close settings button
    const closeSettingsButton = document.getElementById('close-settings');
    if (closeSettingsButton) {
      // Remove existing listeners to prevent duplicates
      const newBtn = closeSettingsButton.cloneNode(true);
      closeSettingsButton.parentNode?.replaceChild(newBtn, closeSettingsButton);
      newBtn.addEventListener('click', toggleSettings); // Now calls the refactored function
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

    // Restart button on Game Over screen
    const restartButton = document.getElementById('restart-button');
    if (restartButton) {
      const gameOverScreen = document.getElementById('game-over-screen');
      restartButton.addEventListener('click', async () => {
        if (gameOverScreen) {
          gameOverScreen.classList.add('hidden');
        }
        await triggerGameReset(); // Call the reset function from engine
        // Music is restarted within triggerGameReset
        canvas.focus(); // Re-focus canvas after UI interaction
      });
    }
    
    console.log('Buttons connected');
  };
  
  // Run setup after a short delay to ensure DOM is ready
  setTimeout(setupButtons, 100);
  
  // Expose keys globally for debugging
  (window as any).gameKeys = keys;

  // Gamepad API Integration
  function handleGamepadConnected(event: GamepadEvent) {
    console.log('Gamepad connected:', event.gamepad);
    gamepads[event.gamepad.index] = event.gamepad;
    previousButtonStates[event.gamepad.index] = {}; // Initialize previous button states for this gamepad
    if (!gamepadPollInterval) {
      gamepadPollInterval = window.setInterval(pollGamepads, 50); // Poll at ~20Hz
    }
  }

  function handleGamepadDisconnected(event: GamepadEvent) {
    console.log('Gamepad disconnected:', event.gamepad);
    delete gamepads[event.gamepad.index];
    delete previousButtonStates[event.gamepad.index];
    if (Object.keys(gamepads).length === 0 && gamepadPollInterval) {
      window.clearInterval(gamepadPollInterval);
      gamepadPollInterval = undefined;
    }
  }

  window.addEventListener('gamepadconnected', handleGamepadConnected);
  window.addEventListener('gamepaddisconnected', handleGamepadDisconnected);

  // Initial check for already connected gamepads and start polling if any
  const checkInitialGamepads = () => {
    const connectedGamepads = navigator.getGamepads();
    let foundGamepad = false;
    for (const gamepad of connectedGamepads) {
      if (gamepad) {
        console.log('Initial gamepad detected:', gamepad);
        gamepads[gamepad.index] = gamepad;
        previousButtonStates[gamepad.index] = {};
        foundGamepad = true;
      }
    }
    if (foundGamepad && !gamepadPollInterval) {
      gamepadPollInterval = window.setInterval(pollGamepads, 50);
    }
  };
  checkInitialGamepads();
  
  console.log('Controls initialization complete');
}

// Function to poll gamepads and update key states
export function pollGamepads(): void {
  const currentGamepads = navigator.getGamepads(); // Get the latest snapshot of all gamepads

  for (const gamepadIndex in gamepads) { // Iterate over *our* tracked gamepads
    const activeGamepadIndex = parseInt(gamepadIndex, 10);
    const gamepad = currentGamepads[activeGamepadIndex]; // Get the latest state for this specific gamepad

    if (gamepad) {
      gamepads[activeGamepadIndex] = gamepad; // Update our stored state

      // Ensure previousButtonStates for this gamepad is initialized
      if (!previousButtonStates[activeGamepadIndex]) {
        previousButtonStates[activeGamepadIndex] = {};
      }

      // Example mapping: Left stick vertical for W/S
      const leftStickY = gamepad.axes[1];
      if (leftStickY < -0.5) { // Up
        keys['w'] = true;
        keys['s'] = false;
      } else if (leftStickY > 0.5) { // Down
        keys['s'] = true;
        keys['w'] = false;
      } else {
        // Release keys if stick is centered, only if they were previously set by gamepad
        if (keys['w'] || keys['s']) { // Check if they need clearing
            keys['w'] = false;
            keys['s'] = false;
        }
      }

      // Example mapping: Left stick horizontal for A/D
      const leftStickX = gamepad.axes[0];
      if (leftStickX < -0.5) { // Left
        keys['a'] = true;
        keys['d'] = false;
      } else if (leftStickX > 0.5) { // Right
        keys['d'] = true;
        keys['a'] = false;
      } else {
        // Release keys if stick is centered
        if (keys['a'] || keys['d']) { // Check if they need clearing
            keys['a'] = false;
            keys['d'] = false;
        }
      }

      // --- Button Mappings ---

      // Helper to check if a button was just pressed (rising edge)
      const isButtonPressed = (buttonIndex: number): boolean => {
        const button = gamepad.buttons[buttonIndex];
        const previousState = previousButtonStates[activeGamepadIndex][buttonIndex];
        return button && button.pressed && !previousState;
      };

      // Helper to check if a button is currently held down
      const isButtonDown = (buttonIndex: number): boolean => {
        return gamepad.buttons[buttonIndex] && gamepad.buttons[buttonIndex].pressed;
      };
      
      // Update previous button states for this gamepad for next frame
      const updatePreviousButtonStates = () => {
        for (let i = 0; i < gamepad.buttons.length; i++) {
          previousButtonStates[activeGamepadIndex][i] = gamepad.buttons[i].pressed;
        }
      };

      // Mapping: Button 0 (e.g., A on Xbox controller) for Space (jump/action) - HELD DOWN
      keys[' '] = isButtonDown(0);

      // Mapping: Button 2 (e.g., X on Xbox controller) for 'c' (toggle CRT) - PRESSED
      if (isButtonPressed(2)) {
        toggleCRT(); // Directly call the refactored function
      }
      
      // Mapping: Button 3 (e.g., Y on Xbox controller) for 's' (toggle Settings) - PRESSED
      if (isButtonPressed(3)) {
        toggleSettings(); 
      }

      // Mapping: Button 4 (e.g., LB on Xbox controller) for 'r' (toggle C64 Retro mode) - PRESSED
      if (isButtonPressed(4)) { 
        toggleC64Mode();
      }

      // Add more mappings as needed for other buttons and axes

      updatePreviousButtonStates(); // IMPORTANT: Update states at the end of processing this gamepad
    } else {
      // Gamepad is no longer available (perhaps unplugged before event fired)
      console.warn(`Gamepad at index ${activeGamepadIndex} is no longer available.`);
      delete gamepads[activeGamepadIndex];
      delete previousButtonStates[activeGamepadIndex];
      if (Object.keys(gamepads).length === 0 && gamepadPollInterval) {
        window.clearInterval(gamepadPollInterval);
        gamepadPollInterval = undefined;
      }
    }
  }
}