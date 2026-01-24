import * as THREE from 'three';
import { initControls, keys } from './ui/controls';
import { initTrail, updateTrail, clearTrail, getTrailPoints } from './game/trail';
import { createScene, updateScene, player } from './game/engine';
import { segmentsIntersect, createOrderedCorners, calculateQixPolygons } from './game/geometryUtils';
import { QixEnemy } from './game/qix_enemy';
import { SparxEnemy } from './game/sparx_enemy';
import { PowerUp, PowerUpType, FreezeQixPowerUp, PlayerSpeedBoostPowerUp, GameTargets } from './game/powerup';
import { playSound, preloadAllGameSounds } from './sound/sound';
import {
    GRID_LIMIT,
    TOTAL_GAME_AREA,
    MAX_POWERUPS_ON_BOARD,
    POWERUP_SPAWN_INTERVAL,
    POWERUP_SIZE,
    POWERUP_SPAWN_MARGIN,
    FUSE_ACTIVATION_DELAY,
    EPSILON,
    QIX_PUSH_MARGIN,
    INITIAL_LIVES,
    PLAYER_SPARX_COLLISION_THRESHOLD,
    BOUNDARY_TOLERANCE
} from './game/config';
import { GameState, createInitialGameState, updateHUD, cacheHUDElements } from './game/gameState';
import { createDebugInfo, getDebugDiv, updateDebugInfo } from './ui/debug';
import { showGameOverScreen, hideGameOverScreen, cacheGameOverElements, getRestartButton } from './ui/gameOverScreen';
import { enhanceModalInteraction } from './ui/modals';

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
let isDrawing = false;

// Use centralized config values
const gridLimit = GRID_LIMIT;
const totalGameArea = TOTAL_GAME_AREA;
let capturedAreaDataList: CapturedAreaData[] = [];
let qix: QixEnemy;
let sparxEnemies: SparxEnemy[] = [];
let playerSpeedMultiplier = { value: 1.0 };

// PowerUp Management
let powerUpsOnBoard: PowerUp[] = [];
let activePowerUpEffects: PowerUp[] = [];
let timeSinceLastPowerUpSpawn = 0.0;

// Fuse Mechanic Variables
let timeTrailOpen: number = 0.0;
let fuseActiveOnTrail: boolean = false;

// Qix Confinement
let qixConfinementRect: { minX: number, maxX: number, minY: number, maxY: number };

// Game state (using module)
const gameState: GameState = createInitialGameState();

// --- Game Restart Function ---
function restartGame() {
  console.log("Restarting game...");
  hideGameOverScreen();

  // Reset game state
  gameState.lives = INITIAL_LIVES;
  gameState.score = 0;
  gameState.captured = 0;
  gameState.level = 1;
  updateHUD(gameState);

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

/**
 * Updates the Qix enemy's confinement area when the player captures a region.
 *
 * Algorithm:
 * 1. Calculate the bounding box of the captured shape
 * 2. Check if the capture "slices" off one side of the current confinement:
 *    - LEFT slice: captured area spans full height and touches left edge
 *    - RIGHT slice: captured area spans full height and touches right edge
 *    - BOTTOM slice: captured area spans full width and touches bottom edge
 *    - TOP slice: captured area spans full width and touches top edge
 * 3. If a slice is detected, shrink the confinement rectangle accordingly
 * 4. Push the Qix position inside the new confinement if it's outside
 * 5. Reverse Qix velocity if it was moving toward the new boundary
 *
 * @param capturedShape - The THREE.Shape representing the newly captured area
 */
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
  const epsilon = EPSILON;

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
    qix.setConfinement(qixConfinementRect);

    let qixPosAdjusted = false;
    const qixLogicPos = qix.position;
    const pushMargin = QIX_PUSH_MARGIN;

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
    }
  }
}

function trySpawnPowerUp(dt: number) {
  timeSinceLastPowerUpSpawn += dt;

  if (timeSinceLastPowerUpSpawn > POWERUP_SPAWN_INTERVAL && powerUpsOnBoard.length < MAX_POWERUPS_ON_BOARD) {
    timeSinceLastPowerUpSpawn = 0; // Reset timer

    let spawnPosition: THREE.Vector2 | null = null;
    const spawnMargin = POWERUP_SPAWN_MARGIN;
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
      Math.abs(Math.abs(player.position.x) - gridLimit) < BOUNDARY_TOLERANCE ||
      Math.abs(Math.abs(player.position.y) - gridLimit) < BOUNDARY_TOLERANCE;

    if (playerOnBoundary) {
      const collisionThreshold = PLAYER_SPARX_COLLISION_THRESHOLD;

      for (const sparx of sparxEnemies) {
        // Ensure sparx.mesh and player.position are valid THREE.Vector3 instances
        // player.position is already a Vector3 from the engine
        // sparx.mesh.position is also a Vector3
        const distance = player.position.distanceTo(sparx.mesh.position);
        if (distance < collisionThreshold) {
          gameState.lives--;
          playSound('playerDeath');

          if (gameState.lives > 0) {
            player.position.set(-gridLimit, -gridLimit, 0);
          } else {
            running = false;
            showGameOverScreen(gameState);
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
      initTrail(scene);
      playSound('drawStart');
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

      if (playerTrailFull.length >= 2) {
        const playerTrailVec2 = playerTrailFull.map(p => new THREE.Vector2(p.x, p.y));
        const { polygon1, polygon2 } = calculateQixPolygons(playerTrailVec2, gridLimit);

        if (polygon1.length >= 3 && polygon2.length >= 3) {
          let chosenPolygonVertices: THREE.Vector2[] | null = null;
          let actualFilledArea = 0;

          const area1 = THREE.ShapeUtils.area(polygon1);
          const area2 = THREE.ShapeUtils.area(polygon2);
          const absArea1 = Math.abs(area1);
          const absArea2 = Math.abs(area2);

          if (absArea1 > 0 && (absArea1 <= absArea2 || absArea2 === 0)) {
            chosenPolygonVertices = [...polygon1];
            actualFilledArea = absArea1;
            if (area1 < 0) chosenPolygonVertices.reverse();
          } else if (absArea2 > 0) {
            chosenPolygonVertices = [...polygon2];
            actualFilledArea = absArea2;
            if (area2 < 0) chosenPolygonVertices.reverse();
          }

          if (chosenPolygonVertices && actualFilledArea > 0) {
            const shape = new THREE.Shape(chosenPolygonVertices);
            updateQixConfinementOnCapture(shape);
            const geometry = new THREE.ShapeGeometry(shape);
            const material = new THREE.MeshPhongMaterial({ color: 0x00ff00, side: THREE.DoubleSide, transparent: true, opacity: 0.5 });
            const capturedMesh = new THREE.Mesh(geometry, material);
            scene.add(capturedMesh);
            capturedAreaDataList.push({ mesh: capturedMesh, shape: shape });

            playSound('areaCapture');

            if (fuseActiveOnTrail) {
              for (const sparx_fuse_check of sparxEnemies) {
                if (sparx_fuse_check.isFuse) {
                  sparx_fuse_check.deactivateFuseMode();
                }
              }
              fuseActiveOnTrail = false;
            }

            const newlyCapturedPercent = (actualFilledArea / totalGameArea) * 100;
            gameState.captured += newlyCapturedPercent;
            gameState.captured = Math.min(gameState.captured, 100);
            gameState.score += Math.round(actualFilledArea);
          }
        }
      }
      clearTrail(scene);
    } else {
      clearTrail(scene);
    }
  }
  spacebarWasPressed = keys[' ']; // Update state for next frame

  // Update trail with current player position only if drawing
  if (isDrawing) {
    updateTrail(scene, player.position);

    // Increment trail open timer and check for Fuse activation
    timeTrailOpen += deltaTime;
    if (!fuseActiveOnTrail && timeTrailOpen > FUSE_ACTIVATION_DELAY) {
      // let fuseActivatedThisFrame = false; // Not strictly needed if only one fuse per trail
      for (const sparx of sparxEnemies) {
        if (!sparx.isFuse) {
          const playerTrailVec3 = getTrailPoints();
          if (playerTrailVec3.length > 0) {
            const playerTrailVec2 = playerTrailVec3.map(p => new THREE.Vector2(p.x, p.y));
            sparx.activateFuseMode(playerTrailVec2);
            fuseActiveOnTrail = true;
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
              gameState.lives--;
              playSound('playerDeath');
              isDrawing = false;
              fuseActiveOnTrail = false;
              clearTrail(scene);

              if (gameState.lives > 0) {
                player.position.set(-gridLimit, -gridLimit, 0);
              } else {
                running = false;
                showGameOverScreen(gameState);
              }
              collisionWithQixDetected = true;
              break;
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
          const FUSE_COLLISION_THRESHOLD = PLAYER_SPARX_COLLISION_THRESHOLD;

          const distance = player.position.distanceTo(sparx.mesh.position);

          if (distance < FUSE_COLLISION_THRESHOLD) {
            gameState.lives--;
            playSound('playerDeath');
            isDrawing = false;
            fuseActiveOnTrail = false;
            clearTrail(scene);
            sparx.deactivateFuseMode();

            if (gameState.lives > 0) {
              player.position.set(-gridLimit, -gridLimit, 0);
            } else {
              running = false;
              showGameOverScreen(gameState);
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
          gameState.lives--;
          playSound('playerDeath');
          isDrawing = false;
          fuseActiveOnTrail = false;
          clearTrail(scene);

          if (gameState.lives <= 0) {
            running = false;
            showGameOverScreen(gameState);
          } else {
            player.position.set(-gridLimit, -gridLimit, 0);
          }
          break;
        }
      }
    }
    // --- End Self-Intersection Check ---
  }
  
  // Update HUD
  updateHUD(gameState);

  // Render the scene
  renderer.render(scene, camera);

  // Update debug info
  const fps = 1000 / (now - lastTime);
  lastTime = now;

  const debugDiv = getDebugDiv();
  if (debugDiv) {
    const activeKeys = Object.entries(keys).filter(([k, v]) => v).map(([k]) => k);
    updateDebugInfo(
      player.position.x,
      player.position.y,
      player.position.z,
      fps,
      activeKeys
    );
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

  // Cache DOM elements for HUD and Game Over screen
  cacheHUDElements();
  cacheGameOverElements(canvas);

  // Preload sounds
  preloadAllGameSounds()
    .then((results) => {
      console.log("Sound preload process completed.");
      results.forEach(result => {
        if (result && typeof result === 'object' && 'status' in result && result.status === 'rejected') {
          console.error("A sound failed to preload:", (result as PromiseRejectedResult).reason);
        }
      });
    });

  // Add event listener for restart button
  const restartButton = getRestartButton();
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