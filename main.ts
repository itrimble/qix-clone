import * as THREE from 'three';
import { initControls, keys } from './ui/controls';
import { initTrail, updateTrail, clearTrail } from './game/trail';
import { 
  createScene, 
  updateScene, 
  player,
  isC64ModeActive,  // Import C64 mode state
  getComposer,      // Import composer getter
  onWindowResize as engineOnWindowResize // Import engine's resize handler
} from './game/engine';
import { loadSounds, playStandardMusic } from './sound/sound';

// Global variables
let scene: THREE.Scene; 
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let canvas: HTMLCanvasElement;
let lastTime = performance.now();
let running = true;
let spacebarWasPressed = false;

// Debug info display
function createDebugInfo() {
  const div = document.createElement('div');
  div.style.position = 'absolute';
  div.style.top = '50px';
  div.style.right = '10px';
  div.style.backgroundColor = 'rgba(0,0,0,0.7)';
  div.style.color = 'cyan';
  div.style.padding = '10px';
  div.style.fontFamily = 'monospace';
  div.style.border = '1px solid cyan';
  div.style.zIndex = '1000';
  div.style.pointerEvents = 'none'; // Don't block clicks
  div.id = 'debugInfo';
  document.body.appendChild(div);
  return div;
}

// Enhanced modal interaction
function enhanceModalInteraction() {
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

// Update game elements and HUD
function updateHUD() {
  const scoreElement = document.getElementById('score');
  const livesElement = document.getElementById('lives');
  const capturedElement = document.getElementById('captured');
  
  if (scoreElement) scoreElement.textContent = `Score: ${gameState.score}`;
  if (livesElement) livesElement.textContent = `Lives: ${gameState.lives}`;
  if (capturedElement) capturedElement.textContent = `Captured: ${gameState.captured}%`;
}

// Game state
const gameState = {
  score: 0,
  lives: 3,
  captured: 0,
  level: 1
};

// Main animation loop
function animate() {
  if (!running) return;
  
  requestAnimationFrame(animate);
  
  // Update game state - pass scene, camera, renderer explicitly
  updateScene(scene, camera, renderer);
  
  // Check for spacebar press to start/clear trail
  if (keys[' '] && !spacebarWasPressed) {
    clearTrail(scene); // Clear existing trail
    initTrail(scene);  // Start a new one
    // console.log('Spacebar pressed, trail cleared and re-initialized.'); // Optional: for debugging
  }
  spacebarWasPressed = keys[' ']; // Update state for next frame
  
  // Update trail with current player position
  updateTrail(scene, player.position);
  
  // Update HUD
  updateHUD();
  
  // Render the scene
  const composer = getComposer();
  if (isC64ModeActive && composer) {
    composer.render();
  } else {
    renderer.render(scene, camera);
  }
  
  // Update debug info
  const now = performance.now();
  const fps = 1000 / (now - lastTime);
  lastTime = now;
  
  if (debugDiv) {
    const activeKeys = Object.entries(keys).filter(([k, v]) => v).map(([k]) => k);
    
    debugDiv.innerHTML = `
      Player: x=${player.position.x.toFixed(2)}, 
              y=${player.position.y.toFixed(2)}, 
              z=${player.position.z.toFixed(2)}<br>
      FPS: ${fps.toFixed(1)}<br>
      Keys: ${activeKeys.join(', ')}
    `;
  }
}

// Handle window resize
function handleResize() {
  if (!camera || !renderer) return;
  
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  
  // Also update engine's composer/shader uniforms if it's handling resize
  engineOnWindowResize(window.innerWidth, window.innerHeight);
}

// Create debug overlay
const debugDiv = createDebugInfo();

// Initialize the game
window.onload = () => {
  console.log('Window loaded...');
  
  // Get canvas
  canvas = document.querySelector('#gameCanvas')!;
  if (!canvas) {
    console.log('Creating canvas...');
    canvas = document.createElement('canvas');
    canvas.id = 'gameCanvas';
    document.body.appendChild(canvas);
  }
  
  console.log('Canvas found/created:', canvas);
  
  // Set initial canvas size
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  
  // Create scene, camera, and renderer
  console.log('Setting up scene...');
  const sceneResult = createScene(canvas);
  scene = sceneResult.scene;
  camera = sceneResult.camera;
  renderer = sceneResult.renderer;

  // Set pixel ratio for sharper images on high DPI displays
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  
  // Initialize controls
  console.log('Setting up controls...');
  initControls(canvas, scene, camera);
  
  // Initialize trail
  console.log('Setting up trail...');
  initTrail(scene);
  
  // Set up event listeners
  window.addEventListener('resize', handleResize);
  
  // Enhance modal interaction
  console.log('Enhancing modal interaction...');
  enhanceModalInteraction();

  // Load sounds
  console.log('Loading sounds...');
  loadSounds();

  // Start background music
  console.log('Starting background music...');
  playStandardMusic(); // Start with standard music
  
  // Expose game state globally for debugging
  (window as any).gameState = gameState;
  
  // Log initialization
  console.log('Game initialized');
  
  // Start the animation loop
  console.log('Starting animation loop...');
  running = true;
  animate();
};