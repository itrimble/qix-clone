/**
 * Modal interaction utilities
 */

/**
 * Enhances modal interaction with event listeners
 * Call this once during initialization
 */
export function enhanceModalInteraction(): void {
  const modal = document.getElementById('settings-modal');
  const closeBtn = document.getElementById('close-settings');
  const levelUpBtn = document.getElementById('level-up');
  const darkModeCheckbox = document.getElementById('darkMode') as HTMLInputElement | null;
  const casualModeCheckbox = document.getElementById('casualMode') as HTMLInputElement | null;
  const crtFilterCheckbox = document.getElementById('crtFilter') as HTMLInputElement | null;

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
