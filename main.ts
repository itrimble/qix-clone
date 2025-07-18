import * as THREE from 'three';
import { initControls, keys } from './ui/controls';
import { initTrail, updateTrail, clearTrail, getTrailPoints } from './game/trail';
import { createScene, updateScene, player } from './game/engine';
import {
    getOrientation,
    onSegment,
    segmentsIntersect,
    createOrderedCorners,
    getSegmentForPoint,
    getBoundaryPath,
    calculateQixPolygons
} from './game/geometryUtils';
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
// let originalPlayerColor = new THREE.Color(0x00ff00); // Default green from engine.ts - this seems unused now

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

// --- Game Over Screen Functions ---
function showGameOverScreen() {
  // Ensure gameState reflects the final values for the game just ended
  saveHighScore(gameState.score);
  saveMaxArea(gameState.captured);
  playSound('gameOver');

  if (gameOverOverlay && finalScoreEl && finalAreaEl && canvas ) {
    finalScoreEl.textContent = gameState.score.toString();
    finalAreaEl.textContent = gameState.captured.toFixed(1); // Format to 1 decimal place for current game display

    if (highScoreDisplayEl && maxAreaDisplayEl) {
      const allTimeHighScore = loadHighScore();
      const allTimeMaxArea = loadMaxArea();

      highScoreDisplayEl.textContent = allTimeHighScore.toString();
      maxAreaDisplayEl.textContent = allTimeMaxArea.toFixed(1); // Consistent formatting

      console.log(`Displayed All-Time High Score: ${allTimeHighScore}, Max Area: ${allTimeMaxArea}%`);
    } else {
      console.error("DOM elements for displaying best stats not found!");
    }

    gameOverOverlay.classList.remove('hidden');
    canvas.classList.add('game-canvas-paused');

    console.log("Game Over Screen Shown. Scores saved (if new records). Best stats displayed.");
  } else {
    console.error("Game Over screen DOM elements not found for showing!");
  }
}

function hideGameOverScreen() {
  if (gameOverOverlay && canvas) {
    gameOverOverlay.classList.add('hidden');
    canvas.classList.remove('game-canvas-paused'); // Remove blur/dim effect
    console.log("Game Over Screen Hidden");
  }
}
// --- End Game Over Screen Functions ---

// --- Game Restart Function ---
function restartGame() {
  console.log("Restarting game...");
  hideGameOverScreen();

  // Reset game state
  gameState.lives = 3;
  gameState.score = 0;
  gameState.captured = 0;
  // gameState.level = 1; // If levels were a thing
  updateHUD(); // Update HUD immediately

  // Reset player
  player.position.set(-gridLimit, -gridLimit, 0); // Uses global gridLimit
  playerSpeedMultiplier.value = 1.0;
  if (player.material instanceof THREE.MeshPhongMaterial) {
       (player.material as THREE.MeshPhongMaterial).color.setHex(0x00ff00); // Default green
  }

  clearTrail(scene); // Trail functions are imported

  // Reset Qix
  qixConfinementRect = { // Reset the main confinement rect
    minX: -gridLimit,
    maxX: gridLimit,
    minY: -gridLimit,
    maxY: gridLimit
  };
  console.log("Qix confinement rectangle reset for new game.");
  if (qix) {
    qix.reset(new THREE.Vector2(0, 0), qixConfinementRect); // Use the reset global rect
  }

  // Reset Sparx
  sparxEnemies.forEach(s => scene.remove(s.mesh));
  sparxEnemies = [];
  const currentOrderedCorners = createOrderedCorners(gridLimit); // Use function
  const sparx1StartPos = currentOrderedCorners[0].clone(); // blCorner
  const sparx1 = new SparxEnemy(0, sparx1StartPos, 1, gridLimit, currentOrderedCorners);
  sparxEnemies.push(sparx1);
  scene.add(sparx1.mesh);

  const sparx2StartPos = currentOrderedCorners[2].clone(); // trCorner
  const sparx2 = new SparxEnemy(2, sparx2StartPos, -1, gridLimit, currentOrderedCorners);
  sparxEnemies.push(sparx2);
  scene.add(sparx2.mesh);
  console.log("Sparx re-initialized.");

  // Clear Power-Ups
  const gameTargetsForReset: GameTargets = {
      playerMesh: player, playerSpeedMultiplier: playerSpeedMultiplier, qix: qix, gameState: gameState, scene: scene
  };
  activePowerUpEffects.forEach(p => {
      if (p.isEffectActive) p.removeEffect(gameTargetsForReset);
  });
  activePowerUpEffects = [];

  powerUpsOnBoard.forEach(p => p.destroy(scene));
  powerUpsOnBoard = [];
  timeSinceLastPowerUpSpawn = 0.0;

  // Clear Captured Areas
  capturedAreaDataList.forEach(data => {
    scene.remove(data.mesh);
    data.mesh.geometry.dispose();
    if (Array.isArray(data.mesh.material)) {
      data.mesh.material.forEach(m => m.dispose());
    } else {
      (data.mesh.material as THREE.Material).dispose();
    }
  });
  capturedAreaDataList = [];

  // Reset game loop
  running = true;
  lastTime = performance.now();

  console.log("Game Reset Complete.");
}
// --- End Game Restart Function ---

function updateQixConfinementOnCapture(capturedShape: THREE.Shape) {
  if (!qix) return;

  const points = capturedShape.getPoints();
  if (points.length === 0) return;
  const capturedBox = new THREE.Box2().setFromPoints(points);

  const currentQixConf = qixConfinementRect;
  let newMinX = currentQixConf.minX;
  let newMaxX = currentQixConf.maxX;
  let newMinY = currentQixConf.minY;
  let newMaxY = currentQixConf.maxY;
  let confinementChanged = false;
  const epsilon = 0.1;

  // Check for slice from LEFT
  if (Math.abs(capturedBox.min.x - currentQixConf.minX) < epsilon &&
      Math.abs(capturedBox.min.y - currentQixConf.minY) < epsilon &&
      Math.abs(capturedBox.max.y - currentQixConf.maxY) < epsilon &&
      capturedBox.max.x < currentQixConf.maxX - epsilon) {
    newMinX = capturedBox.max.x;
    confinementChanged = true;
  }
  // Check for slice from RIGHT
  else if (Math.abs(capturedBox.max.x - currentQixConf.maxX) < epsilon &&
      Math.abs(capturedBox.min.y - currentQixConf.minY) < epsilon &&
      Math.abs(capturedBox.max.y - currentQixConf.maxY) < epsilon &&
      capturedBox.min.x > currentQixConf.minX + epsilon) {
    newMaxX = capturedBox.min.x;
    confinementChanged = true;
  }
  // Check for slice from BOTTOM
  else if (Math.abs(capturedBox.min.y - currentQixConf.minY) < epsilon &&
      Math.abs(capturedBox.min.x - currentQixConf.minX) < epsilon &&
      Math.abs(capturedBox.max.x - currentQixConf.maxX) < epsilon &&
      capturedBox.max.y < currentQixConf.maxY - epsilon) {
    newMinY = capturedBox.max.y;
    confinementChanged = true;
  }
  // Check for slice from TOP
  else if (Math.abs(capturedBox.max.y - currentQixConf.maxY) < epsilon &&
      Math.abs(capturedBox.min.x - currentQixConf.minX) < epsilon &&
      Math.abs(capturedBox.max.x - currentQixConf.maxX) < epsilon &&
      capturedBox.min.y > currentQixConf.minY + epsilon) {
    newMaxY = capturedBox.min.y;
    confinementChanged = true;
  }

  if (confinementChanged) {
    qixConfinementRect = { minX: newMinX, maxX: newMaxX, minY: newMinY, maxY: newMaxY };
    console.log("Qix global confinement rect updated to:", qixConfinementRect);
    qix.setConfinement(qixConfinementRect);

    let qixPosAdjusted = false;
    const qixLogicPos = qix.position;
    const pushMargin = 0.2;

    if (qixLogicPos.x < qixConfinementRect.minX) {
        qixLogicPos.x = qixConfinementRect.minX + pushMargin; qixPosAdjusted = true;
        if(qix.velocity.x < 0) qix.velocity.x *= -1;
    }
    if (qixLogicPos.x > qixConfinementRect.maxX) {
        qixLogicPos.x = qixConfinementRect.maxX - pushMargin; qixPosAdjusted = true;
        if(qix.velocity.x > 0) qix.velocity.x *= -1;
    }
    if (qixLogicPos.y < qixConfinementRect.minY) {
        qixLogicPos.y = qixConfinementRect.minY + pushMargin; qixPosAdjusted = true;
        if(qix.velocity.y < 0) qix.velocity.y *= -1;
    }
    if (qixLogicPos.y > qixConfinementRect.maxY) {
        qixLogicPos.y = qixConfinementRect.maxY - pushMargin; qixPosAdjusted = true;
        if(qix.velocity.y > 0) qix.velocity.y *= -1;
    }

    if (qixPosAdjusted) {
      qix.mesh.position.set(qixLogicPos.x, qixLogicPos.y, 0);
      qix.updateLineGeometry();
      console.log("Qix position and velocity adjusted for new confinement:", qixLogicPos, qix.velocity);
    }
  }
}

function trySpawnPowerUp(dt: number) {
  timeSinceLastPowerUpSpawn += dt;

  if (timeSinceLastPowerUpSpawn > POWERUP_SPAWN_INTERVAL && powerUpsOnBoard.length < MAX_POWERUPS_ON_BOARD) {
    timeSinceLastPowerUpSpawn = 0; // Reset timer

    let spawnPosition: THREE.Vector2 | null = null;
    const spawnMargin = 2.0; // Don't spawn too close to edges
    const maxAttempts = 10; // Attempts to find a valid spawn position

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const x = THREE.MathUtils.randFloat(-gridLimit + spawnMargin, gridLimit - spawnMargin);
      const y = THREE.MathUtils.randFloat(-gridLimit + spawnMargin, gridLimit - spawnMargin);
      const potentialPos = new THREE.Vector2(x, y);

      // Check for overlap with existing captured areas (simplified check)
      let overlapsCapturedArea = false;
      const powerUpBox = new THREE.Box3(
        new THREE.Vector3(x - POWERUP_SIZE / 2, y - POWERUP_SIZE / 2, -0.1),
        new THREE.Vector3(x + POWERUP_SIZE / 2, y + POWERUP_SIZE / 2, 0.1)
      );
      for (const areaData of capturedAreaDataList) {
        const areaBox = new THREE.Box3().setFromObject(areaData.mesh);
        if (powerUpBox.intersectsBox(areaBox)) {
          overlapsCapturedArea = true;
          break;
        }
      }

      if (!overlapsCapturedArea) {
        spawnPosition = potentialPos;
        break;
      }
    }

    if (spawnPosition) {
      let newPowerUp: PowerUp;
      const randomType = Math.random() < 0.5 ? PowerUpType.FREEZE_QIX : PowerUpType.PLAYER_SPEED_BOOST;

      if (randomType === PowerUpType.FREEZE_QIX) {
        newPowerUp = new FreezeQixPowerUp(spawnPosition, scene); // Pass scene if constructor needs it
      } else {
        newPowerUp = new PlayerSpeedBoostPowerUp(spawnPosition);
      }

      powerUpsOnBoard.push(newPowerUp);
      scene.add(newPowerUp.mesh);
      console.log(`Spawned ${newPowerUp.type} at (${spawnPosition.x.toFixed(2)}, ${spawnPosition.y.toFixed(2)})`);
    } else {
      console.log("Failed to find suitable spawn location for power-up after multiple attempts.");
    }
  }
}

// Main animation loop
function animate() {
  if (!running) return;
  
  requestAnimationFrame(animate);

  const now = performance.now();
  const deltaTime = (now - lastTime) / 1000.0; // deltaTime in seconds
  // lastTime is updated later, before rendering debug info.
  
  // Update game state
  updateScene(scene, playerSpeedMultiplier.value);

  // Update Qix Enemy
  if (qix) {
    const shapesForCollision = capturedAreaDataList.map(data => data.shape);
    qix.update(deltaTime, shapesForCollision);
  }

  // Update Sparx Enemies
  for (const sparx of sparxEnemies) {
    sparx.update(deltaTime);
  }

  // Try Spawning PowerUps
  trySpawnPowerUp(deltaTime);

  // Player-PowerUp Collection Check
  const playerBoundingBox = new THREE.Box3().setFromObject(player); // player is the THREE.Mesh
  for (let i = powerUpsOnBoard.length - 1; i >= 0; i--) {
    const powerUp = powerUpsOnBoard[i];
    if (!powerUp.mesh || !powerUp.isAvailableForCollection) continue;

    const powerUpBoundingBox = new THREE.Box3().setFromObject(powerUp.mesh);
    if (playerBoundingBox.intersectsBox(powerUpBoundingBox)) {
      const gameTargets: GameTargets = {
        playerMesh: player,
        playerSpeedMultiplier: playerSpeedMultiplier,
        qix: qix,
        gameState: gameState,
        scene: scene
      };
      playSound('powerupCollect');
      powerUp.collect(scene, gameTargets);
      playSound('powerupActivate');
      activePowerUpEffects.push(powerUp);
      powerUpsOnBoard.splice(i, 1); // Remove from on-board list
      break; // Collect one per frame
    }
  }

  // Update Active PowerUp Effects
  for (let i = activePowerUpEffects.length - 1; i >= 0; i--) {
    const powerUp = activePowerUpEffects[i];
    const gameTargets: GameTargets = {
       playerMesh: player, playerSpeedMultiplier: playerSpeedMultiplier, qix: qix, gameState: gameState, scene: scene
    };
    powerUp.update(deltaTime, gameTargets);

    if (!powerUp.isEffectActive) { // Effect has expired and removeEffect was called
      activePowerUpEffects.splice(i, 1); // Remove from active effects list
    }
  }

  // Player-Sparx Collision Check (Player on Boundary)
  if (!isDrawing && running) { // Only check if not drawing and game is running
    const playerOnBoundary =
      Math.abs(Math.abs(player.position.x) - gridLimit) < 0.1 ||
      Math.abs(Math.abs(player.position.y) - gridLimit) < 0.1;

    if (playerOnBoundary) {
      const PLAYER_SIZE = 2.0;
      const SPARX_SIZE = 0.5; // From SparxEnemy.SPARX_SIZE
      const collisionThreshold = (PLAYER_SIZE / 2) + (SPARX_SIZE / 2);

      for (const sparx of sparxEnemies) {
        // Ensure sparx.mesh and player.position are valid THREE.Vector3 instances
        // player.position is already a Vector3 from the engine
        // sparx.mesh.position is also a Vector3
        const distance = player.position.distanceTo(sparx.mesh.position);
        if (distance < collisionThreshold) {
          console.log("Player hit by Sparx on boundary!");
          gameState.lives--;
          playSound('playerDeath');

          if (gameState.lives > 0) {
            player.position.set(-gridLimit, -gridLimit, 0); // Reposition to bottom-left corner
            console.log(`Player repositioned after Sparx collision. Lives: ${gameState.lives}`);
          } else { // gameState.lives <= 0
            console.log("GAME OVER - Hit by Sparx!");
            running = false;
            showGameOverScreen();
          }
          // isDrawing is already false.
          // No trail to clear as player wasn't drawing.
          // Potentially add a brief invulnerability period or player respawn logic here
          break; // Player hit, no need to check other Sparx this frame.
        }
      }
    }
  }

  // Check for spacebar press to start drawing
  if (keys[' '] && !spacebarWasPressed && !isDrawing) { // Check !isDrawing to prevent re-triggering
    const onBoundary = Math.abs(player.position.x) >= gridLimit || Math.abs(player.position.y) >= gridLimit;
    if (onBoundary) {
      isDrawing = true;
      timeTrailOpen = 0.0; // Reset fuse timer
      fuseActiveOnTrail = false; // Reset fuse active flag for this trail
      clearTrail(scene); // Clear any previous partial trail
      initTrail(scene);  // Start a new trail
      playSound('drawStart');
      console.log('Drawing started from boundary.');
    } else {
      console.log('Cannot start drawing from open space for capture. Must be on a boundary.');
    }
  }

  // Check for spacebar release to stop drawing
  if (!keys[' '] && spacebarWasPressed && isDrawing) { // Spacebar was released while drawing
    isDrawing = false;
    fuseActiveOnTrail = false; // Reset fuse active flag
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

            const shape = new THREE.Shape(chosenPolygonVertices); // This is the 'shape' instance we need
            updateQixConfinementOnCapture(shape); // Call the new function
            const geometry = new THREE.ShapeGeometry(shape);
            const material = new THREE.MeshPhongMaterial({ color: 0x00ff00, side: THREE.DoubleSide, transparent: true, opacity: 0.5 }); // Changed color for testing
            const capturedMesh = new THREE.Mesh(geometry, material);
            scene.add(capturedMesh);
            capturedAreaDataList.push({ mesh: capturedMesh, shape: shape }); // Ensure this line is correct

            playSound('areaCapture');
            // Deactivate Fuse if active upon successful capture
            if (fuseActiveOnTrail) {
              for (const sparx_fuse_check of sparxEnemies) { // Renamed sparx to avoid conflict
                if (sparx_fuse_check.isFuse) {
                  sparx_fuse_check.deactivateFuseMode();
                  console.log("Active Fuse Sparx deactivated due to area capture.");
                }
              }
              fuseActiveOnTrail = false;
            }

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

    // Increment trail open timer and check for Fuse activation
    timeTrailOpen += deltaTime;
    if (!fuseActiveOnTrail && timeTrailOpen > FUSE_ACTIVATION_DELAY_SECONDS) {
      // let fuseActivatedThisFrame = false; // Not strictly needed if only one fuse per trail
      for (const sparx of sparxEnemies) {
        if (!sparx.isFuse) {
          const playerTrailVec3 = getTrailPoints();
          if (playerTrailVec3.length > 0) {
            const playerTrailVec2 = playerTrailVec3.map(p => new THREE.Vector2(p.x, p.y));
            sparx.activateFuseMode(playerTrailVec2);
            fuseActiveOnTrail = true;
            // fuseActivatedThisFrame = true;
            console.log("Fuse mechanic activated on a Sparx.");
            break;
          }
        }
      }
      // if (fuseActivatedThisFrame) { timeTrailOpen = 0; } // Optional: reset for multiple fuses on same trail
    }

    // --- Player-Qix Collision Check ---
    if (qix) { // Ensure qix exists
      const playerTrailVec3_qixCheck = getTrailPoints();
      if (playerTrailVec3_qixCheck.length >= 2) {
        const playerTrailVec2_qixCheck = playerTrailVec3_qixCheck.map(p => new THREE.Vector2(p.x, p.y));
        const qixBodySegments = qix.getLineSegments();

        let collisionWithQixDetected = false;
        for (let i = 0; i < playerTrailVec2_qixCheck.length - 1; i++) {
          const trailSegP1 = playerTrailVec2_qixCheck[i];
          const trailSegP2 = playerTrailVec2_qixCheck[i+1];

          for (const qixSeg of qixBodySegments) {
            if (segmentsIntersect(trailSegP1, trailSegP2, qixSeg.p1, qixSeg.p2)) {
              console.log("Player trail hit Qix!");
              gameState.lives--;
              playSound('playerDeath');
              isDrawing = false;
              fuseActiveOnTrail = false; // Reset fuse active flag
              clearTrail(scene);

              if (gameState.lives > 0) {
                player.position.set(-gridLimit, -gridLimit, 0); // Reposition to bottom-left corner
                console.log(`Player repositioned after Qix collision. Lives: ${gameState.lives}`);
              } else { // gameState.lives <= 0
                console.log("GAME OVER - Hit Qix!");
                running = false;
                showGameOverScreen();
              }
              collisionWithQixDetected = true;
              break; // Break from inner qixSeg loop
            }
          }
          if (collisionWithQixDetected) {
            break; // Break from outer playerTrail loop
          }
        }
      }
    }
    // --- End Player-Qix Collision Check ---

    // --- Fuse-Player Collision Check (Player's Head vs Fused Sparx) ---
    // This must be checked while isDrawing is still true from this frame's perspective
    if (running) { // Check 'running' again, as Qix collision might have set it to false
      for (const sparx of sparxEnemies) {
        if (sparx.isFuse) {
          const PLAYER_SIZE = 2.0;
          const SPARX_SIZE = 0.5;
          const FUSE_COLLISION_THRESHOLD = (PLAYER_SIZE / 2) + (SPARX_SIZE / 2);

          const distance = player.position.distanceTo(sparx.mesh.position);

          if (distance < FUSE_COLLISION_THRESHOLD) {
            console.log("Player caught by Fuse!");
            gameState.lives--;
            playSound('playerDeath');
            isDrawing = false;
            fuseActiveOnTrail = false;
            clearTrail(scene);
            sparx.deactivateFuseMode();

            if (gameState.lives > 0) {
              player.position.set(-gridLimit, -gridLimit, 0);
              console.log(`Player repositioned after Fuse collision. Lives: ${gameState.lives}`);
            } else {
              console.log("GAME OVER - Caught by Fuse!");
              running = false;
              showGameOverScreen();
            }
            break;
          }
        }
      }
    }
    // --- End Fuse-Player Collision Check ---

    // --- Self-Intersection Check ---
    // This check will only run if isDrawing is still true (i.e., no Qix or Fuse collision occurred)
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
          playSound('playerDeath');
          isDrawing = false; // Stop drawing
          fuseActiveOnTrail = false; // Reset fuse active flag
          clearTrail(scene);  // Clear the offending trail
          // updateHUD(); // updateHUD is called every frame anyway, but if not, call here

          if (gameState.lives <= 0) { // This else block is for trail self-intersection
            console.log("GAME OVER - No lives left (self-intersection).");
            running = false; // Stop the game loop
            showGameOverScreen();
          } else { // Player lost a life due to self-intersection but game not over
             player.position.set(-gridLimit, -gridLimit, 0); // Reposition to bottom-left corner
             console.log(`Player repositioned after self-intersection. Lives: ${gameState.lives}`);
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
  // const now = performance.now(); // 'now' is already calculated for deltaTime
  const fps = 1000 / (now - lastTime); // This will be high if lastTime isn't updated correctly before this
  lastTime = now; // Update lastTime for the next frame's deltaTime and current frame's FPS
  
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

  // Initialize Qix Enemy
  console.log('Setting up Qix enemy...');
  qixConfinementRect = {
    minX: -gridLimit,
    maxX: gridLimit,
    minY: -gridLimit,
    maxY: gridLimit
  };
  console.log("Initial Qix confinement rectangle set:", qixConfinementRect);
  const qixSpawnPos = new THREE.Vector2(0, 0);
  // QixEnemy now takes the overall confinement. Its internal logic might add margins if needed.
  qix = new QixEnemy(qixSpawnPos, qixConfinementRect);
  scene.add(qix.mesh);

  // Initialize Sparx Enemies
  console.log('Setting up Sparx enemies...');
  const currentOrderedCorners = createOrderedCorners(gridLimit); // Use function
  const sparx1StartPos = currentOrderedCorners[0].clone(); // blCorner
  const sparx1 = new SparxEnemy(0, sparx1StartPos, 1, gridLimit, currentOrderedCorners);
  sparxEnemies.push(sparx1);
  scene.add(sparx1.mesh);

  const sparx2StartPos = currentOrderedCorners[2].clone(); // trCorner
  const sparx2 = new SparxEnemy(2, sparx2StartPos, -1, gridLimit, currentOrderedCorners);
  sparxEnemies.push(sparx2);
  scene.add(sparx2.mesh);
  
  // Set up event listeners
  window.addEventListener('resize', handleResize);
  
  // Enhance modal interaction
  console.log('Enhancing modal interaction...');
  enhanceModalInteraction();
  
  // Expose game state globally for debugging
  (window as any).gameState = gameState;

  // Assign Game Over Screen DOM elements
  gameOverOverlay = document.getElementById('game-over-overlay');
  finalScoreEl = document.getElementById('final-score');
  finalAreaEl = document.getElementById('final-area');
  restartButton = document.getElementById('restart-button');
  highScoreDisplayEl = document.getElementById('high-score-display');
  maxAreaDisplayEl = document.getElementById('max-area-display');
  // 'canvas' is already assigned earlier in window.onload

  // Preload sounds
  preloadAllGameSounds()
    .then((results) => {
      console.log("Sound preload process completed.");
      results.forEach(result => {
        if (result.status === 'rejected') {
          console.error("A sound failed to preload:", result.reason);
        }
      });
    });

  // Add event listener for restart button
  if (restartButton) {
    restartButton.addEventListener('click', () => {
      playSound('buttonClick');
      restartGame();
    });
  } else {
    console.error("Restart button not found!");
  }

  // Ensure Game Over screen is hidden on start
  hideGameOverScreen();
  
  // Log initialization
  console.log('Game initialized');
  
  // Start the animation loop
  console.log('Starting animation loop...');
  running = true;
  animate();
};