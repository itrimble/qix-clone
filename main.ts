import * as THREE from 'three';
import { initControls, keys } from './ui/controls';
import { initTrail, updateTrail, clearTrail, getTrailPoints } from './game/trail';
import { createScene, updateScene, player } from './game/engine';
import { QixEnemy } from './game/qix_enemy';
import { SparxEnemy } from './game/sparx_enemy';
import { PowerUp, PowerUpType, FreezeQixPowerUp, PlayerSpeedBoostPowerUp, GameTargets } from './game/powerup';
import { playSound, preloadAllGameSounds } from './sound/sound';

// LocalStorage Keys
const STORAGE_KEY_HIGH_SCORE = 'qixCloneGame_highScore';
const STORAGE_KEY_MAX_AREA = 'qixCloneGame_maxAreaCaptured';

// Global variables
interface CapturedAreaData {
  mesh: THREE.Mesh;
  shape: THREE.Shape;
}

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
let capturedAreaDataList: CapturedAreaData[] = []; // Changed from capturedAreas
let qix: QixEnemy;
let sparxEnemies: SparxEnemy[] = [];
let playerSpeedMultiplier = { value: 1.0 };
let originalPlayerColor = new THREE.Color(0x00ff00); // Default green from engine.ts

// PowerUp Management
let powerUpsOnBoard: PowerUp[] = [];
let activePowerUpEffects: PowerUp[] = [];
const MAX_POWERUPS_ON_BOARD = 2;
const POWERUP_SPAWN_INTERVAL = 15.0; // seconds
let timeSinceLastPowerUpSpawn = 0.0;
const POWERUP_SIZE = 0.7; // Should match size used in PowerUp subclasses for bounding box

// DOM Element References for Game Over Screen
let gameOverOverlay: HTMLElement | null;
let finalScoreEl: HTMLElement | null;
let finalAreaEl: HTMLElement | null;
let restartButton: HTMLElement | null;
let highScoreDisplayEl: HTMLElement | null;
let maxAreaDisplayEl: HTMLElement | null;
// Note: 'canvas' is already our reference to the game canvas element

// Fuse Mechanic Variables
let timeTrailOpen: number = 0.0;
const FUSE_ACTIVATION_DELAY_SECONDS: number = 3.0;
let fuseActiveOnTrail: boolean = false;

// Qix Confinement
let qixConfinementRect: { minX: number, maxX: number, minY: number, maxY: number };

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

// --- LocalStorage Helper Functions ---
function loadHighScore(): number {
  try {
    const storedScoreStr = localStorage.getItem(STORAGE_KEY_HIGH_SCORE);
    if (storedScoreStr !== null) {
      const score = parseFloat(storedScoreStr);
      return isNaN(score) ? 0 : score;
    }
  } catch (e) {
    console.error("Error loading high score from localStorage:", e);
  }
  return 0;
}

function saveHighScore(newScore: number): void {
  try {
    const currentHighScore = loadHighScore();
    if (newScore > currentHighScore) {
      localStorage.setItem(STORAGE_KEY_HIGH_SCORE, newScore.toString());
      console.log(`New High Score saved: ${newScore}`);
    }
  } catch (e) {
    console.error("Error saving high score to localStorage:", e);
  }
}

function loadMaxArea(): number {
  try {
    const storedAreaStr = localStorage.getItem(STORAGE_KEY_MAX_AREA);
    if (storedAreaStr !== null) {
      const area = parseFloat(storedAreaStr);
      return isNaN(area) ? 0 : area;
    }
  } catch (e) {
    console.error("Error loading max area from localStorage:", e);
  }
  return 0;
}

function saveMaxArea(newArea: number): void {
  try {
    const currentMaxArea = loadMaxArea();
    const formattedNewArea = parseFloat(newArea.toFixed(1)); // Consistent precision

    if (formattedNewArea > currentMaxArea) {
      localStorage.setItem(STORAGE_KEY_MAX_AREA, formattedNewArea.toString());
      console.log(`New Max Area Captured saved: ${formattedNewArea}%`);
    }
  } catch (e) {
    console.error("Error saving max area to localStorage:", e);
  }
}
// --- End LocalStorage Helper Functions ---

// Continue with rest of implementation in next part...