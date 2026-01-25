// ui/tutorial.ts - Interactive tutorial system for new players

const TUTORIAL_STORAGE_KEY = 'qix_tutorial_completed';

interface TutorialStep {
  title: string;
  content: string;
  highlightElement?: string; // CSS selector for element to highlight
  action?: string; // What user needs to do to proceed
}

const tutorialSteps: TutorialStep[] = [
  {
    title: 'Welcome to Qix Clone!',
    content: 'This quick tutorial will teach you how to play. Use Arrow Keys or WASD to move.',
    action: 'Click Next to continue'
  },
  {
    title: 'Step 1: Move to the Edge',
    content: 'Move your ship to the glowing cyan boundary. You can only start drawing from the edge!',
    highlightElement: '#game-canvas',
    action: 'Move to any edge of the playing field'
  },
  {
    title: 'Step 2: Start Drawing',
    content: 'Press and HOLD SPACEBAR to start drawing a line (Stix). For 2x points, hold SHIFT + SPACEBAR for slow draw!',
    action: 'Press SPACEBAR while on the edge'
  },
  {
    title: 'Step 3: Create a Shape',
    content: 'While holding SPACEBAR, move across the grid to draw a shape. Avoid the Qix (enemy) and Sparx!',
    action: 'Draw a path across the grid'
  },
  {
    title: 'Step 4: Complete the Capture',
    content: 'Return to ANY edge while still holding SPACEBAR to capture territory. The smaller area (without the Qix) will be filled!',
    action: 'Return to an edge to complete your shape'
  },
  {
    title: 'Goal: Capture 75%',
    content: 'Fill 75% of the grid to advance to the next level. Watch out for enemies and the fuse timer! Good luck!',
    action: 'Click Start Game to begin'
  }
];

let currentStep = 0;
let tutorialOverlay: HTMLDivElement | null = null;
let tutorialModal: HTMLDivElement | null = null;
let onTutorialComplete: (() => void) | null = null;

function createTutorialElements(): void {
  // Create overlay
  tutorialOverlay = document.createElement('div');
  tutorialOverlay.id = 'tutorial-overlay';
  tutorialOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    z-index: 1000;
    display: flex;
    justify-content: center;
    align-items: center;
  `;

  // Create modal
  tutorialModal = document.createElement('div');
  tutorialModal.id = 'tutorial-modal';
  tutorialModal.style.cssText = `
    background: linear-gradient(135deg, #1a1a2e 0%, #0f0f23 100%);
    border: 2px solid #00ffff;
    border-radius: 10px;
    padding: 30px;
    max-width: 500px;
    width: 90%;
    color: #fff;
    font-family: 'Orbitron', 'Press Start 2P', monospace;
    box-shadow: 0 0 30px rgba(0, 255, 255, 0.3);
  `;

  tutorialOverlay.appendChild(tutorialModal);
  document.body.appendChild(tutorialOverlay);
}

function renderStep(): void {
  if (!tutorialModal) return;

  const step = tutorialSteps[currentStep];
  const isLastStep = currentStep === tutorialSteps.length - 1;
  const isFirstStep = currentStep === 0;

  tutorialModal.innerHTML = `
    <div style="text-align: center; margin-bottom: 20px;">
      <span style="color: #00ffff; font-size: 12px;">
        Step ${currentStep + 1} of ${tutorialSteps.length}
      </span>
    </div>
    <h2 style="color: #00ffff; margin: 0 0 15px 0; font-size: 18px; text-align: center;">
      ${step.title}
    </h2>
    <p style="color: #ccc; line-height: 1.6; margin: 0 0 20px 0; font-size: 14px; text-align: center;">
      ${step.content}
    </p>
    <div style="display: flex; justify-content: space-between; gap: 10px;">
      ${!isFirstStep ? `
        <button id="tutorial-prev" style="
          background: transparent;
          border: 1px solid #666;
          color: #666;
          padding: 10px 20px;
          font-family: inherit;
          cursor: pointer;
          border-radius: 5px;
          transition: all 0.2s;
        ">Back</button>
      ` : '<div></div>'}
      <button id="tutorial-skip" style="
        background: transparent;
        border: 1px solid #ff4444;
        color: #ff4444;
        padding: 10px 20px;
        font-family: inherit;
        cursor: pointer;
        border-radius: 5px;
        transition: all 0.2s;
      ">Skip Tutorial</button>
      <button id="tutorial-next" style="
        background: #00ffff;
        border: none;
        color: #000;
        padding: 10px 25px;
        font-family: inherit;
        cursor: pointer;
        border-radius: 5px;
        font-weight: bold;
        transition: all 0.2s;
      ">${isLastStep ? 'Start Game' : 'Next'}</button>
    </div>
  `;

  // Add event listeners
  const nextBtn = document.getElementById('tutorial-next');
  const prevBtn = document.getElementById('tutorial-prev');
  const skipBtn = document.getElementById('tutorial-skip');

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (isLastStep) {
        completeTutorial();
      } else {
        currentStep++;
        renderStep();
      }
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      currentStep--;
      renderStep();
    });
  }

  if (skipBtn) {
    skipBtn.addEventListener('click', () => {
      completeTutorial();
    });
  }
}

function completeTutorial(): void {
  // Mark tutorial as completed
  localStorage.setItem(TUTORIAL_STORAGE_KEY, 'true');

  // Remove tutorial elements
  if (tutorialOverlay) {
    tutorialOverlay.remove();
    tutorialOverlay = null;
    tutorialModal = null;
  }

  // Call completion callback
  if (onTutorialComplete) {
    onTutorialComplete();
  }
}

export function shouldShowTutorial(): boolean {
  return localStorage.getItem(TUTORIAL_STORAGE_KEY) !== 'true';
}

export function startTutorial(onComplete?: () => void): void {
  currentStep = 0;
  onTutorialComplete = onComplete || null;
  createTutorialElements();
  renderStep();
}

export function resetTutorial(): void {
  localStorage.removeItem(TUTORIAL_STORAGE_KEY);
  console.log('Tutorial reset - will show on next game start');
}

// Export for settings menu
export function showTutorialFromSettings(): void {
  localStorage.removeItem(TUTORIAL_STORAGE_KEY);
  startTutorial();
}
