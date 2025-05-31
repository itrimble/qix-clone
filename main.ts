import * as THREE from 'three';
import { initControls, keys } from './ui/controls';
import { initTrail, updateTrail, clearTrail, getTrailPoints } from './game/trail';
import { createScene, updateScene, player } from './game/engine';

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

// --- Qix Polygon Calculation Utilities ---
const blCorner = new THREE.Vector2(-gridLimit, -gridLimit);
const brCorner = new THREE.Vector2(gridLimit, -gridLimit);
const trCorner = new THREE.Vector2(gridLimit, gridLimit);
const tlCorner = new THREE.Vector2(-gridLimit, gridLimit);
const orderedCorners = [blCorner, brCorner, trCorner, tlCorner]; // Clockwise order

function getSegmentForPoint(point: THREE.Vector2, gl: number): number {
  if (point.y === -gl && point.x > -gl && point.x < gl) return 0; // Bottom (exclusive of corners)
  if (point.x === gl && point.y > -gl && point.y < gl) return 1;  // Right (exclusive of corners)
  if (point.y === gl && point.x < gl && point.x > -gl) return 2;   // Top (exclusive of corners)
  if (point.x === -gl && point.y < gl && point.y > -gl) return 3; // Left (exclusive of corners)

  // Handle corners: assign to the segment they start in CW order
  if (point.equals(blCorner)) return 0; // Belongs to bottom segment start
  if (point.equals(brCorner)) return 1; // Belongs to right segment start
  if (point.equals(trCorner)) return 2; // Belongs to top segment start
  if (point.equals(tlCorner)) return 3; // Belongs to left segment start
  console.warn(`Point ${point.x},${point.y} is not on boundary or corner.`);
  return -1; // Should not happen if point is on boundary
}

function getBoundaryPath(p1: THREE.Vector2, p2: THREE.Vector2, isClockwise: boolean, gl: number): THREE.Vector2[] {
  const path: THREE.Vector2[] = [p1.clone()]; // Start with a clone of p1
  let currentSeg = getSegmentForPoint(p1, gl);
  const targetSeg = getSegmentForPoint(p2, gl);

  if (p1.equals(p2)) return [p1.clone()]; // Path of zero length if points are same

  // Check if p1 or p2 are not on a segment (e.g. error in input or getSegmentForPoint)
  if (currentSeg === -1) {
    console.error("getBoundaryPath: p1 is not on a valid segment", p1);
    return [p1.clone()]; // Return p1 to avoid further errors
  }
   if (targetSeg === -1) {
    console.error("getBoundaryPath: p2 is not on a valid segment", p2);
    // Depending on desired robustness, could return path with p1, or p1 and p2.
    // For now, just add p2 and hope for the best or let downstream handle it.
    path.push(p2.clone());
    return path;
  }

  for (let i = 0; i < 8; i++) { // Max 4 segments + some buffer for complex cases/loops
    if (currentSeg === targetSeg) {
        // If p1 and p2 are on the same segment.
        // If clockwise, p1 must be "before" p2 or at the same spot.
        // If counter-clockwise, p1 must be "after" p2 or at the same spot.
        // This simplified version assumes this condition is met or points are distinct enough.
        // No intermediate corners are needed if they are on the same segment and path direction is valid.
        break;
    }

    let cornerToAdd: THREE.Vector2;
    if (isClockwise) {
      cornerToAdd = orderedCorners[(currentSeg + 1) % 4];
      currentSeg = (currentSeg + 1) % 4;
    } else { // Counter-clockwise
      cornerToAdd = orderedCorners[currentSeg];
      currentSeg = (currentSeg + 3) % 4; // Move to previous segment (wraps around)
    }
    path.push(cornerToAdd.clone());
    if (cornerToAdd.equals(p2)) break;
    if (path.length > 6) { // Safety break for unexpected loops
        console.error("getBoundaryPath exceeded max iterations, something is wrong.", p1, p2, isClockwise);
        break;
    }
  }

  if (!path[path.length-1].equals(p2)) {
    path.push(p2.clone());
  }
  return path;
}

function calculateQixPolygons(playerTrail: THREE.Vector2[], gl: number): { polygon1: THREE.Vector2[], polygon2: THREE.Vector2[] } {
  if (playerTrail.length < 2) {
    console.warn("calculateQixPolygons: Player trail too short.");
    return { polygon1: [], polygon2: [] }; // Not enough points
  }
  const startTrailNode = playerTrail[0];
  const endTrailNode = playerTrail[playerTrail.length - 1];

  // Path along boundary, clockwise from end to start
  const boundaryPathCW = getBoundaryPath(endTrailNode, startTrailNode, true, gl);
  // Path along boundary, counter-clockwise from end to start
  const boundaryPathCCW = getBoundaryPath(endTrailNode, startTrailNode, false, gl);

  // Polygon 1: Player's trail + clockwise path along boundary
  const polygon1Vertices = [...playerTrail.map(p=>p.clone()), ...boundaryPathCW.slice(1)];

  // Polygon 2: Player's trail + counter-clockwise path along boundary
  const polygon2Vertices = [...playerTrail.map(p=>p.clone()), ...boundaryPathCCW.slice(1)];

  if (polygon1Vertices.length > 1 && polygon1Vertices[polygon1Vertices.length - 1].equals(polygon1Vertices[0])) {
     polygon1Vertices.pop();
  }
  if (polygon2Vertices.length > 1 && polygon2Vertices[polygon2Vertices.length - 1].equals(polygon2Vertices[0])) {
     polygon2Vertices.pop();
  }

  return { polygon1: polygon1Vertices, polygon2: polygon2Vertices };
}
// --- End Qix Polygon Calculation Utilities ---

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
  
  // Update game state
  updateScene(scene);
  
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
        // No trail to clear as it's too short or already cleared by self-intersection.
      } else {
        const playerTrailVec2 = playerTrailFull.map(p => new THREE.Vector2(p.x, p.y));

        const { polygon1, polygon2 } = calculateQixPolygons(playerTrailVec2, gridLimit);

        if (polygon1.length < 3 || polygon2.length < 3) {
          console.error("Invalid polygons returned from calculation. Skipping capture.");
        } else {
          let chosenPolygonVertices: THREE.Vector2[] | null = null;
          let actualFilledArea = 0;

          const area1 = THREE.ShapeUtils.area(polygon1); // Already checked length >= 3
          const area2 = THREE.ShapeUtils.area(polygon2);

          console.log(`Calculated Polygon Areas: Area1=${area1.toFixed(2)}, Area2=${area2.toFixed(2)}`);

          const absArea1 = Math.abs(area1);
          const absArea2 = Math.abs(area2);

          if (absArea1 > 0 && (absArea1 <= absArea2 || absArea2 === 0)) {
            chosenPolygonVertices = [...polygon1];
            actualFilledArea = absArea1;
            if (area1 < 0) { // Ensure CCW winding for THREE.Shape
              chosenPolygonVertices.reverse();
              console.log("Polygon 1 chosen and reversed for CCW winding.");
            } else {
              console.log("Polygon 1 chosen.");
            }
          } else if (absArea2 > 0) {
            chosenPolygonVertices = [...polygon2];
            actualFilledArea = absArea2;
            if (area2 < 0) { // Ensure CCW winding for THREE.Shape
              chosenPolygonVertices.reverse();
              console.log("Polygon 2 chosen and reversed for CCW winding.");
            } else {
              console.log("Polygon 2 chosen.");
            }
          } else {
            console.log("Neither polygon has a valid area for capture.");
          }

          if (chosenPolygonVertices && actualFilledArea > 0) {
            console.log(`Selected polygon with area: ${actualFilledArea.toFixed(2)}`);

            const shape = new THREE.Shape(chosenPolygonVertices);
            const geometry = new THREE.ShapeGeometry(shape);
            const material = new THREE.MeshPhongMaterial({ color: 0x00ff00, side: THREE.DoubleSide, transparent: true, opacity: 0.5 }); // Changed color for testing
            const capturedMesh = new THREE.Mesh(geometry, material);
            scene.add(capturedMesh);
            capturedAreas.push(capturedMesh);

            const newlyCapturedPercent = (actualFilledArea / totalGameArea) * 100;
            gameState.captured += newlyCapturedPercent;
            gameState.captured = Math.min(gameState.captured, 100);
            gameState.score += Math.round(actualFilledArea); // Or some other score metric
            console.log(`(Updated GS) Filled Area: ${actualFilledArea.toFixed(2)}, New %: ${newlyCapturedPercent.toFixed(2)}, Total %: ${gameState.captured.toFixed(2)}, Score: ${gameState.score}`);
          } else {
            console.log("No valid polygon chosen for capture. No area filled.");
          }
        }
      }
      clearTrail(scene); // Clear the drawing line trail regardless of capture success
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
  renderer.render(scene, camera);
  
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
  
  // Expose game state globally for debugging
  (window as any).gameState = gameState;
  
  // Log initialization
  console.log('Game initialized');
  
  // Start the animation loop
  console.log('Starting animation loop...');
  running = true;
  animate();
};