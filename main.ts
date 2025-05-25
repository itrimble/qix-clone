import * as THREE from 'three';
import { initControls, keys } from './ui/controls';
import { initTrail, updateTrail, clearTrail, getTrailPoints } from './game/trail';
import {
  createScene,
  updateScene,
  player,
  isC64ModeActive, // If needed
  getComposerSize as engineOnWindowResize, // If needed
  onWindowResize, // If needed
  getComposer // If needed
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
let isDrawing = false; // Tracks if the player is currently drawing a trail

const gridLimit = 14; // Defines the boundary for starting/ending drawing
const totalGameArea = (2 * gridLimit) * (2 * gridLimit); // Total area of the game grid
let capturedAreas: THREE.Mesh[] = []; // Stores meshes of captured areas

// --- Intersection Detection Utilities ---

// Helper function to find orientation of ordered triplet (p, q, r).
// Returns 0 if p, q, r are collinear, 1 if clockwise, 2 if counterclockwise.
function getOrientation(p: THREE.Vector2, q: THREE.Vector2, r: THREE.Vector2): number {
  const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
  if (val === 0) return 0; // Collinear
  return (val > 0) ? 1 : 2; // Clockwise or Counterclockwise
}

// Helper function to check if point q lies on segment pr.
function onSegment(p: THREE.Vector2, q: THREE.Vector2, r: THREE.Vector2): boolean {
  return (q.x <= Math.max(p.x, r.x) && q.x >= Math.min(p.x, r.x) &&
          q.y <= Math.max(p.y, r.y) && q.y >= Math.min(p.y, r.y));
}

function segmentsIntersect(p1: THREE.Vector2, q1: THREE.Vector2, p2: THREE.Vector2, q2: THREE.Vector2): boolean {
  const o1 = getOrientation(p1, q1, p2);
  const o2 = getOrientation(p1, q1, q2);
  const o3 = getOrientation(p2, q2, p1);
  const o4 = getOrientation(p2, q2, q1);

  // General case: segments cross each other
  if (o1 !== 0 && o2 !== 0 && o3 !== 0 && o4 !== 0) {
     // Check if orientations are different for actual intersection (not just extensions)
     if (o1 !== o2 && o3 !== o4) {
         // Additional check to prevent intersection if endpoints are merely touching,
         // but allow if they cross *through* an endpoint.
         // This basic version might still report true if an endpoint of one segment
         // lies *on* the other segment. True Qix usually penalizes this.
         // For simplicity, we'll use this standard check.
         // A more robust check would ensure endpoints are not identical.
         if (p1.equals(p2) || p1.equals(q2) || q1.equals(p2) || q1.equals(q2)) {
             return false; // Segments share an endpoint, not a crossing for Qix
         }
         return true;
     }
  }
  
  // Special Cases for collinearity:
  // Check if segments are collinear and overlap.
  // o1, o2, o3, o4 are orientations. If any three points are collinear, one of these will be 0.

  if (o1 === 0 && onSegment(p1, p2, q1)) return true; // p1, q1, p2 are collinear and p2 lies on segment p1q1
  if (o2 === 0 && onSegment(p1, q2, q1)) return true; // p1, q1, q2 are collinear and q2 lies on segment p1q1
  if (o3 === 0 && onSegment(p2, p1, q2)) return true; // p2, q2, p1 are collinear and p1 lies on segment p2q2
  if (o4 === 0 && onSegment(p2, q1, q2)) return true; // p2, q2, q1 are collinear and q1 lies on segment p2q2
  
  return false; // Doesn't fall in any of the above cases
}

// --- End Intersection Detection Utilities ---

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
  
  // Check for spacebar press to start drawing
  if (keys[' '] && !spacebarWasPressed && !isDrawing) { // Check !isDrawing to prevent re-triggering
    const onBoundary = Math.abs(player.position.x) >= gridLimit || Math.abs(player.position.y) >= gridLimit;
    if (onBoundary) {
      isDrawing = true;
      clearTrail(scene); // Clear any previous partial trail
      initTrail(scene);  // Start a new trail
      console.log('Drawing started from boundary.');
    } else {
      console.log('Cannot start drawing from open space for capture. Must be on a boundary.');
    }
  }

  // Check for spacebar release to stop drawing
  if (!keys[' '] && spacebarWasPressed && isDrawing) { // Spacebar was released while drawing
    isDrawing = false;
    const onBoundary = Math.abs(player.position.x) >= gridLimit || Math.abs(player.position.y) >= gridLimit;
    if (onBoundary) {
      // --- Start of Capture Logic ---
      const playerTrailFull = getTrailPoints();

      if (playerTrailFull.length < 2) {
        console.log("Trail too short to capture.");
        clearTrail(scene); // Clear the short trail
        // return or continue; // Exit this block if inside a larger if/else
      } else {
        const playerTrail = playerTrailFull.map(p => new THREE.Vector2(p.x, p.y)); // Convert to Vector2 for Shape/Area

        // const startPoint = playerTrail[0];
        // const endPoint = playerTrail[playerTrail.length - 1];

        // Define boundary corners (as Vector2 for simplicity here)
        // const tl = new THREE.Vector2(-gridLimit, gridLimit);
        // const tr = new THREE.Vector2(gridLimit, gridLimit);
        // const bl = new THREE.Vector2(-gridLimit, -gridLimit);
        // const br = new THREE.Vector2(gridLimit, -gridLimit);

        // Simplified polygon formation:
        // This creates two polygons by connecting the trail ends to the top-left/top-right
        // and bottom-left/bottom-right corners of the screen, respectively.
        // This is a major simplification and will only work correctly for specific trail shapes.

        // const poly1Vertices = [...playerTrail]; // Path from start to end
        // Logic to decide which corners to add for poly1
        // This part is complex. For a first pass, let's assume a simple case:
        // Trail from left wall to right wall.
        // Poly1 (top part): trail + tr + tl
        // Poly2 (bottom part): trail + br + bl (but trail needs to be reversed for winding order for Poly2)

        // Simplified: create one polygon using player trail and two fixed corners (e.g. top-right, top-left)
        // This won't correctly implement the "smaller area" rule yet.
        // The goal here is to get *any* shape filled based on the trail.

        // let verticesForShape: THREE.Vector2[] = [...playerTrail];
        // Example: if trail ends on right wall, add tr, then tl. This is naive.
        // A proper solution requires checking which boundary segments the start/end points are on
        // and then adding the correct corners to close the shape.

        // For this subtask, let's create a simple polygon by closing the trail
        // with a line segment directly from endPoint back to startPoint.
        // This will fill the area enclosed by the trail itself, not Qix-style area capture yet.
        // This is to test the Shape/Mesh creation.
        if (playerTrail.length >= 3) { // Need at least 3 points for a shape
          const shape = new THREE.Shape(playerTrail); // Use the trail itself as the shape
          
          // --- Start of Area Calculation & Game State Update ---
          const filledArea = THREE.ShapeUtils.area(playerTrail);
          
          if (filledArea > 0) { // Only update if area is positive (valid polygon)
            const newlyCapturedPercent = (filledArea / totalGameArea) * 100;
            gameState.captured += newlyCapturedPercent;
            // Ensure captured doesn't go way over 100 due to multiple small captures summing up with floating point issues
            gameState.captured = Math.min(gameState.captured, 100); 

            gameState.score += Math.round(filledArea); // Or some other score metric

            console.log(`Filled Area: ${filledArea.toFixed(2)}`);
            console.log(`Newly Captured Percent: ${newlyCapturedPercent.toFixed(2)}%`);
            console.log(`Total Captured: ${gameState.captured.toFixed(2)}%`);
            console.log(`Score: ${gameState.score}`);
          } else {
            console.log("Filled area is zero or negative, not updating game state.");
          }
          // --- End of Area Calculation & Game State Update ---

          const geometry = new THREE.ShapeGeometry(shape);
          const material = new THREE.MeshPhongMaterial({ color: 0x0000ff, side: THREE.DoubleSide, transparent: true, opacity: 0.5 });
          const capturedMesh = new THREE.Mesh(geometry, material);
          scene.add(capturedMesh);
          capturedAreas.push(capturedMesh);
          // console.log('Captured a shape (trail loop). Area calculation done.'); // Updated log
        } else {
          console.log("Trail not long enough to form a shape for this simplified fill.");
        }
        
        clearTrail(scene); // Clear the trail that was just processed
      }
      // --- End of Capture Logic ---
    } else {
      console.log('Drawing finished in open space (not on a boundary). Trail cleared.');
      clearTrail(scene); // Clear incomplete trail
    }
  }

  spacebarWasPressed = keys[' ']; // Update state for next frame
  
  // Update trail with current player position only if drawing
  if (isDrawing) {
    updateTrail(scene, player.position);

    // --- Self-Intersection Check ---
    const trailForCheck = getTrailPoints(); // Get fresh points (Vector3)

    if (trailForCheck.length >= 4) { // Need at least 4 points for a possible self-intersection of non-adjacent segments
      const trailToCheckAsV2 = trailForCheck.map(p => new THREE.Vector2(p.x, p.y));

      const headP1 = trailToCheckAsV2[trailToCheckAsV2.length - 2];
      const headP2 = trailToCheckAsV2[trailToCheckAsV2.length - 1]; // Player's current position

      // Check against all segments except the one immediately connected to the head segment
      for (let i = 0; i < trailToCheckAsV2.length - 3; i++) {
        const tailP1 = trailToCheckAsV2[i];
        const tailP2 = trailToCheckAsV2[i+1];

        if (segmentsIntersect(headP1, headP2, tailP1, tailP2)) {
          console.log("Trail crossed itself!");
          gameState.lives--;
          isDrawing = false; // Stop drawing
          clearTrail(scene);  // Clear the offending trail
          // updateHUD(); // updateHUD is called every frame anyway, but if not, call here
          
          if (gameState.lives <= 0) {
            console.log("GAME OVER - No lives left.");
            running = false; // Stop the game loop
            // You might want to show a game over screen here in a more complete game
          }
          break; // Exit loop once an intersection is found
        }
      }
    }
    // --- End Self-Intersection Check ---
  }
  
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