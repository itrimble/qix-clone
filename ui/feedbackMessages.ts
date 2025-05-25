// ui/feedbackMessages.ts

let messageContainer: HTMLDivElement | null = null;
let messageTimeout: number | undefined;
let messageTransitionTimeout: number | undefined;

function ensureMessageContainer(): HTMLDivElement {
  if (!messageContainer) {
    messageContainer = document.createElement('div');
    messageContainer.id = 'feedback-message-container';
    // Most styles are now in style.css
    document.body.appendChild(messageContainer);
  }
  return messageContainer;
}

export function showFeedbackMessage(message: string, duration: number = 2000): void {
  const container = ensureMessageContainer();
  
  container.textContent = message;
  container.style.display = 'block'; // Make it visible to allow transition
  
  // Timeout to allow display:block to take effect before opacity transition
  setTimeout(() => {
    container.style.opacity = '1';
  }, 10); 

  if (messageTimeout) {
    clearTimeout(messageTimeout);
  }
  if (messageTransitionTimeout) {
    clearTimeout(messageTransitionTimeout);
  }

  messageTimeout = window.setTimeout(() => {
    container.style.opacity = '0'; // Trigger fade-out transition
    
    // Set timeout to hide element after transition completes
    // (must match transition duration in CSS, e.g., 0.3s)
    messageTransitionTimeout = window.setTimeout(() => {
        container.style.display = 'none';
    }, 300); // Corresponds to 0.3s transition in CSS

  }, duration); 
}

// Example Usage (can be called from other modules):
// import { showFeedbackMessage } from './ui/feedbackMessages';
// showFeedbackMessage("Game Saved!", 2000);
// showFeedbackMessage("Level Up!", 1500);

// Function for screen flash effect
let flashOverlay: HTMLDivElement | null = null;
let flashTimeout: number | undefined;
let flashTransitionTimeout: number | undefined;


function ensureFlashOverlay(): HTMLDivElement {
  if (!flashOverlay) {
    flashOverlay = document.createElement('div');
    flashOverlay.id = 'flash-overlay';
    // Most styles are now in style.css
    document.body.appendChild(flashOverlay);
  }
  return flashOverlay;
}

export function triggerScreenFlash(duration: number = 300, color: string = 'rgba(255, 0, 0, 0.5)'): void {
  const overlay = ensureFlashOverlay();
  overlay.style.backgroundColor = color; // Set color before showing
  overlay.style.display = 'block';

  // Timeout to allow display:block to take effect before opacity transition
  setTimeout(() => {
    overlay.style.opacity = '0.7'; // Flash opacity (can be adjusted)
  }, 10);

  if (flashTimeout) {
    clearTimeout(flashTimeout);
  }
  if (flashTransitionTimeout) {
    clearTimeout(flashTransitionTimeout);
  }

  flashTimeout = window.setTimeout(() => {
    overlay.style.opacity = '0'; // Trigger fade-out transition

    // Set timeout to hide element after transition completes
    // (must match transition duration in CSS, e.g., 0.1s for flash)
    flashTransitionTimeout = window.setTimeout(() => {
        overlay.style.display = 'none';
    }, 100); // Corresponds to 0.1s transition in CSS for flash

  }, duration);
}

// Example:
// triggerScreenFlash(250, 'rgba(255, 255, 0, 0.4)'); // Yellow flash
// triggerScreenFlash(); // Default red flash
