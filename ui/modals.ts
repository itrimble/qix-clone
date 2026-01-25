/**
 * Modal interaction utilities
 */

import { createMusicPlayer, updateMusicPlayerUI } from './musicPlayer';
import { showTutorialFromSettings } from './tutorial';

/**
 * Enhances modal interaction with event listeners
 * Call this once during initialization
 */
export function enhanceModalInteraction(): void {
  const modal = document.getElementById('settings-modal');
  const modalContent = modal?.querySelector('.modal-content');
  const closeBtn = document.getElementById('close-settings');
  const levelUpBtn = document.getElementById('level-up');
  const darkModeCheckbox = document.getElementById('darkMode') as HTMLInputElement | null;
  const casualModeCheckbox = document.getElementById('casualMode') as HTMLInputElement | null;
  const crtFilterCheckbox = document.getElementById('crtFilter') as HTMLInputElement | null;

  // Add music player to modal
  if (modalContent) {
    const musicPlayer = createMusicPlayer();
    modalContent.insertBefore(musicPlayer, closeBtn?.parentElement || null);

    // Add tutorial reset button
    const tutorialBtn = document.createElement('button');
    tutorialBtn.id = 'show-tutorial';
    tutorialBtn.textContent = 'Show Tutorial';
    tutorialBtn.style.cssText = `
      margin-top: 10px;
      margin-right: 10px;
      padding: 8px 15px;
      background: transparent;
      border: 1px solid #00ffff;
      color: #00ffff;
      font-family: inherit;
      cursor: pointer;
      border-radius: 3px;
    `;
    tutorialBtn.addEventListener('click', () => {
      if (modal) modal.classList.add('hidden');
      showTutorialFromSettings();
    });
    closeBtn?.parentElement?.insertBefore(tutorialBtn, closeBtn);
  }

  // Update music player when modal is opened
  const settingsButton = document.getElementById('settings-button');
  if (settingsButton) {
    settingsButton.addEventListener('click', () => {
      updateMusicPlayerUI();
    });
  }

  // Close button
  if (closeBtn) {
    closeBtn.addEventListener('click', function() {
      if (modal) modal.classList.add('hidden');
    });
  }

  // Level up button
  if (levelUpBtn) {
    levelUpBtn.addEventListener('click', function() {
      console.log('Level up clicked!');
      if (modal) modal.classList.add('hidden');

      // Show on-screen feedback
      const flashElement = document.createElement('div');
      flashElement.textContent = 'LEVEL UP!';
      flashElement.style.position = 'absolute';
      flashElement.style.top = '50%';
      flashElement.style.left = '50%';
      flashElement.style.transform = 'translate(-50%, -50%)';
      flashElement.style.color = '#00ffff';
      flashElement.style.fontFamily = 'Orbitron, sans-serif';
      flashElement.style.fontSize = '32px';
      flashElement.style.fontWeight = 'bold';
      flashElement.style.zIndex = '1000';
      document.body.appendChild(flashElement);

      setTimeout(() => {
        document.body.removeChild(flashElement);
      }, 2000);
    });
  }

  // Dark mode checkbox
  if (darkModeCheckbox) {
    darkModeCheckbox.addEventListener('change', function(this: HTMLInputElement) {
      document.body.classList.toggle('dark-mode', this.checked);
    });
  }

  // Casual mode checkbox
  if (casualModeCheckbox) {
    casualModeCheckbox.addEventListener('change', function(this: HTMLInputElement) {
      console.log('Casual mode:', this.checked);
    });
  }

  // CRT filter checkbox
  if (crtFilterCheckbox) {
    crtFilterCheckbox.addEventListener('change', function(this: HTMLInputElement) {
      document.body.classList.toggle('crt', this.checked);
      const crtButton = document.getElementById('crt-toggle');
      if (crtButton) {
        crtButton.textContent = this.checked ? 'CRT: ON' : 'CRT: OFF';
      }
    });
  }
}
