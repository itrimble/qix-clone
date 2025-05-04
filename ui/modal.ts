// ui/modal.ts

export function enhanceModalInteraction() {
  // Get all the modal elements
  const modal = document.getElementById('settings-modal');
  const closeBtn = document.getElementById('close-settings');
  const levelUpBtn = document.getElementById('level-up');
  const darkModeCheckbox = document.getElementById('darkMode');
  const casualModeCheckbox = document.getElementById('casualMode');
  const crtFilterCheckbox = document.getElementById('crtFilter');
  
  // Make sure the modal close button works
  if (closeBtn) {
    closeBtn.addEventListener('click', function() {
      if (modal) modal.classList.add('hidden');
    });
  }
  
  // LEVEL UP button functionality
  if (levelUpBtn) {
    levelUpBtn.addEventListener('click', function() {
      console.log('Level up clicked!');
      if (modal) modal.classList.add('hidden');
      
      // Show some on-screen feedback
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
      
      // Remove the flash message after a delay
      setTimeout(() => {
        document.body.removeChild(flashElement);
      }, 2000);
    });
  }
  
  // Make sure checkboxes work
  if (darkModeCheckbox) {
    darkModeCheckbox.addEventListener('change', function() {
      document.body.classList.toggle('dark-mode', this.checked);
    });
  }
  
  if (casualModeCheckbox) {
    casualModeCheckbox.addEventListener('change', function() {
      // Implement your casual mode logic here
      console.log('Casual mode:', this.checked);
    });
  }
  
  if (crtFilterCheckbox) {
    crtFilterCheckbox.addEventListener('change', function() {
      document.body.classList.toggle('crt', this.checked);
      const crtButton = document.getElementById('crt-toggle');
      if (crtButton) {
        crtButton.textContent = this.checked ? 'CRT: ON' : 'CRT: OFF';
      }
    });
  }
}