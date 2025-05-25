import * as THREE from 'three';
import { createStarfield, createNebulaGradient } from './backgrounds';
import { keys } from '../ui/controls';
import { LevelManager } from './levelManager';
import { showFeedbackMessage } from '../ui/feedbackMessages';
import { 
  playerMaterial, 
  sceneBackgroundColor, 
  gridColor, 
  gridCenterLineColor,
  edgeMaterial 
} from './materials';

// Post-processing imports
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

// Shader code as strings
const c64VertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const c64FragmentShader = `
uniform sampler2D tDiffuse;
uniform vec2 resolution;
uniform float pixelSize;
varying vec2 vUv;

const int PALETTE_SIZE = 16;
vec3 c64Palette[PALETTE_SIZE];

void initializePalette() {
    c64Palette[0] = vec3(0.0, 0.0, 0.0);
    c64Palette[1] = vec3(1.0, 1.0, 1.0);
    c64Palette[2] = vec3(136.0/255.0, 0.0, 0.0);
    c64Palette[3] = vec3(170.0/255.0, 1.0, 238.0/255.0);
    c64Palette[4] = vec3(204.0/255.0, 68.0/255.0, 204.0/255.0);
    c64Palette[5] = vec3(0.0, 204.0/255.0, 85.0/255.0);
    c64Palette[6] = vec3(0.0, 0.0, 170.0/255.0);
    c64Palette[7] = vec3(238.0/255.0, 238.0/255.0, 119.0/255.0);
    c64Palette[8] = vec3(221.0/255.0, 136.0/255.0, 85.0/255.0);
    c64Palette[9] = vec3(102.0/255.0, 68.0/255.0, 0.0);
    c64Palette[10] = vec3(255.0/255.0, 119.0/255.0, 119.0/255.0);
    c64Palette[11] = vec3(51.0/255.0, 51.0/255.0, 51.0/255.0);
    c64Palette[12] = vec3(119.0/255.0, 119.0/255.0, 119.0/255.0);
    c64Palette[13] = vec3(170.0/255.0, 255.0/255.0, 102.0/255.0);
    c64Palette[14] = vec3(0.0, 136.0/255.0, 255.0/255.0);
    c64Palette[15] = vec3(187.0/255.0, 187.0/255.0, 187.0/255.0);
}

vec3 quantizeColor(vec3 color) {
    float minDistance = 10000.0;
    vec3 closestColor = c64Palette[0];
    for (int i = 0; i < PALETTE_SIZE; i++) {
        float dist = distance(color, c64Palette[i]);
        if (dist < minDistance) {
            minDistance = dist;
            closestColor = c64Palette[i];
        }
    }
    return closestColor;
}

void main() {
    initializePalette();
    vec2 effectiveResolution = resolution / pixelSize;
    vec2 pixelatedUV = floor(vUv * effectiveResolution) / effectiveResolution;
    pixelatedUV += (0.5 / effectiveResolution);
    vec4 originalColor = texture2D(tDiffuse, pixelatedUV);
    vec3 quantizedColor = quantizeColor(originalColor.rgb);
    gl_FragColor = vec4(quantizedColor, originalColor.a);
}`;


// Global variables
export let player: THREE.Mesh;
let levelManager: LevelManager;
const clock = new THREE.Clock();

// C64 Mode related
let composer: EffectComposer;
let c64ShaderPass: ShaderPass;
export let isC64ModeActive: boolean = false; // Export for potential UI update
const C64_PIXEL_SIZE = 8.0; // Adjust for more or less pixelation

// --- Save/Load Functionality ---
const SAVE_KEY = 'retroGridSaveData';

interface GameSaveState {
  playerPosition: {
    x: number;
    y: number;
    z: number;
  };
  score: number;
  currentLevel: number;
  lives: number; // Add lives to save state
}

export function saveGameState(): void {
  if (!player || !levelManager) {
    console.warn('Player or LevelManager not found, cannot save game state.');
    return;
  }
  const state: GameSaveState = {
    playerPosition: {
      x: player.position.x,
      y: player.position.y,
      z: player.position.z,
    },
    score: levelManager.getCurrentScore(),
    currentLevel: levelManager.getCurrentLevel(),
    lives: levelManager.getCurrentLives(), // Save current lives
  };

  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    console.log('Game state saved:', state);
    showFeedbackMessage("Game Saved!", 2000); // Display feedback message
  } catch (error) {
    console.error('Error saving game state:', error);
    showFeedbackMessage("Error Saving Game!", 2000); // Display error feedback
  }
}

export function loadGameState(): void {
  if (!player || !levelManager) {
    // This function should ideally be called after player and levelManager are initialized
    console.warn('Player or LevelManager not found, cannot load game state yet.');
    return;
  }
  try {
    const savedData = localStorage.getItem(SAVE_KEY);
    if (savedData) {
      const state: GameSaveState = JSON.parse(savedData);
      console.log('Loading game state:', state);
      
      if (state.playerPosition) {
        player.position.set(
          state.playerPosition.x,
          state.playerPosition.y,
          state.playerPosition.z
        );
        console.log('Player position loaded to:', player.position);
      }

      if (typeof state.score === 'number') {
        levelManager.score = state.score;
        // Update display if needed, LevelManager handles its own score display updates
        // The ID 'score-display' was an old one, it's 'score' now.
        // LevelManager.update() or advanceToLevel() should handle this.
        // const scoreElement = document.getElementById('score');
        // if (scoreElement) scoreElement.textContent = `Score: ${levelManager.score}`;
      }

      if (typeof state.lives === 'number' && state.lives >= 0) {
        levelManager.lives = state.lives;
      } else {
        levelManager.lives = 3; // Default to 3 lives if not in save or invalid
      }
      // No direct method in LevelManager to just update display, 
      // but it gets updated on construction and on collision.
      // Forcing an update here after loading to be sure.
      const livesElement = document.getElementById('lives');
      if (livesElement) livesElement.textContent = `Lives: ${levelManager.lives}`;
      
      if (typeof state.currentLevel === 'number' && state.currentLevel >= 1) {
        levelManager.advanceToLevel(state.currentLevel);
      } else {
        levelManager.advanceToLevel(1); // Default to level 1
      }
      
      console.log(`Loaded score: ${levelManager.getCurrentScore()}, level: ${levelManager.getCurrentLevel()}, lives: ${levelManager.getCurrentLives()}`);

    } else {
      console.log('No saved game state found. Starting fresh.');
      levelManager.lives = 3; // Ensure fresh start has 3 lives
      const livesElement = document.getElementById('lives');
      if (livesElement) livesElement.textContent = `Lives: ${levelManager.lives}`;
      if (levelManager) levelManager.advanceToLevel(1); // This also updates score/level display
    }
  } catch (error) {
    console.error('Error loading game state:', error);
    showFeedbackMessage("Error Loading Save!", 2000);
    if (levelManager) {
        levelManager.lives = 3; // Reset to default on error
        const livesElement = document.getElementById('lives');
        if (livesElement) livesElement.textContent = `Lives: ${levelManager.lives}`;
        levelManager.advanceToLevel(1);
    }
  }
}

// --- End Save/Load Functionality ---

export function createScene(canvas: HTMLCanvasElement) {
  console.log('Creating scene...');
  
  // Create scene
  const scene = new THREE.Scene();
  scene.background = sceneBackgroundColor; // Use color from materials.ts

  // Initialize LevelManager
  levelManager = new LevelManager(scene); // scene is passed here
  
  // Create camera with proper aspect ratio
  const camera = new THREE.PerspectiveCamera(
    75, // Field of view
    canvas.width / canvas.height, // Aspect ratio
    0.1, // Near clipping plane
    1000 // Far clipping plane
  );
  
  // Position camera to see the scene (moved further back)
  camera.position.z = 15;
  
  // Create renderer with proper settings
  const renderer = new THREE.WebGLRenderer({ 
    canvas,
    antialias: true,
    alpha: false // No transparency needed for the main renderer
  });
  renderer.setSize(canvas.width, canvas.height);
  renderer.setClearColor(0x000000, 1); // Solid black background
  
  // Add lighting - Slightly adjusted for potentially different material responses
  // const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); // Softer ambient
  const ambientLight = new THREE.AmbientLight(0x9090a0, 1.0); // Cooler ambient
  scene.add(ambientLight);
  
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8); // Slightly stronger directional
  directionalLight.position.set(5, 10, 7.5); // Adjusted position for better angles
  scene.add(directionalLight);

  // Optional: Hemisphere Light for softer overall lighting
  const hemisphereLight = new THREE.HemisphereLight(0x606070, 0x202030, 0.6); // sky, ground, intensity
  scene.add(hemisphereLight);
  
  // Add grid for reference - using colors from materials.ts
  const gridSize = 30;
  const gridDivisions = 30;
  const gridHelper = new THREE.GridHelper(gridSize, gridDivisions, gridCenterLineColor, gridColor);
  gridHelper.rotation.x = Math.PI / 2; // Rotate to XY plane
  scene.add(gridHelper);
  
  // Add background elements
  // Using Nebula as main background now instead of just black or starfield alone
  const nebulaTexture = createNebulaGradient(renderer.capabilities.getMaxAnisotropy());
  scene.background = nebulaTexture; // Nebula gradient
  
  const starfield = createStarfield(1500); // More stars
  scene.add(starfield); // Stars on top of nebula
  
  // Create player cube - using playerMaterial from materials.ts
  const playerGeometry = new THREE.BoxGeometry(2, 2, 2); // Keep size
  player = new THREE.Mesh(playerGeometry, playerMaterial); // Use imported material
  scene.add(player);

  // Add edges to the player for a wireframe highlight effect
  const playerEdgesGeometry = new THREE.EdgesGeometry(playerGeometry);
  const playerWireframe = new THREE.LineSegments(playerEdgesGeometry, edgeMaterial);
  player.add(playerWireframe); // Add wireframe as a child of the player mesh
  
  // Move player to a visible starting position (default)
  player.position.set(0, 0, 0); 
  
  // Attempt to load game state after player and levelManager are initialized
  loadGameState(); 
  
  console.log('Scene created with player at', player.position);

  // Setup EffectComposer for C64 mode
  composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const c64Shader = {
    uniforms: {
      'tDiffuse': { value: null },
      'resolution': { value: new THREE.Vector2(canvas.width, canvas.height) },
      'pixelSize': { value: C64_PIXEL_SIZE }
    },
    vertexShader: c64VertexShader,
    fragmentShader: c64FragmentShader
  };
  c64ShaderPass = new ShaderPass(c64Shader);
  composer.addPass(c64ShaderPass);
  // c64ShaderPass.enabled = false; // Start with C64 mode off - this will be handled by toggleC64Mode

  return { scene, camera, renderer }; // Return original renderer for main.ts
}

// Function to toggle C64 mode
export function toggleC64Mode(): void {
  isC64ModeActive = !isC64ModeActive;
  // c64ShaderPass.enabled = isC64ModeActive; // Enable/disable the pass
  console.log(`C64 Mode: ${isC64ModeActive ? 'ON' : 'OFF'}`);
  showFeedbackMessage(`C64 Mode: ${isC64ModeActive ? 'ON' : 'OFF'}`, 1500);

  // If turning C64 mode ON, you might want to adjust materials for better results
  // e.g., reduce shininess, use flat shading, simplify colors.
  // For now, the shader handles pixelation and color palette.
  // We also need to ensure the composer's resolution is updated on resize.
  if (renderer && composer) {
      const { width, height } = renderer.getSize(new THREE.Vector2());
      composer.setSize(width, height);
      if (c64ShaderPass) {
          c64ShaderPass.uniforms.resolution.value.set(width, height);
      }
  }
}


export function updateScene(sceneRef: THREE.Scene, cameraRef: THREE.Camera, rendererRef: THREE.WebGLRenderer) { 
  const deltaTime = clock.getDelta();

  if (levelManager) {
    levelManager.update(deltaTime);
  }

  // Handle player movement
  const speed = 0.25;
  
  // Verbose debugging when keys are pressed
  const activeKeys = Object.entries(keys).filter(([k, v]) => v).map(([k]) => k);
  if (activeKeys.length > 0) {
    console.log('Active keys:', activeKeys.join(', '));
  }
  
  // Move player based on keyboard input
  if (keys['arrowup'] || keys['ArrowUp'] || keys['w']) {
    player.position.y += speed;
    console.log('Moving UP', player.position.y);
  }
  if (keys['arrowdown'] || keys['ArrowDown'] || keys['s']) {
    player.position.y -= speed;
    console.log('Moving DOWN', player.position.y);
  }
  if (keys['arrowleft'] || keys['ArrowLeft'] || keys['a']) {
    player.position.x -= speed;
    console.log('Moving LEFT', player.position.x);
  }
  if (keys['arrowright'] || keys['ArrowRight'] || keys['d']) {
    player.position.x += speed;
    console.log('Moving RIGHT', player.position.x);
  }
  
  // Add a small rotation to the player for visual feedback
  player.rotation.x += 0.01;
  player.rotation.y += 0.01;
  
  // Limit player movement to the grid
  const gridLimit = 14; 
  player.position.x = Math.max(-gridLimit, Math.min(gridLimit, player.position.x));
  player.position.y = Math.max(-gridLimit, Math.min(gridLimit, player.position.y));

  // RENDER LOGIC: Choose direct render or composer render
  // This will be handled in main.ts's animate loop
}

// Expose composer for main.ts to use in render loop
export function getComposer(): EffectComposer | undefined {
    return composer;
}

// Handle resize for composer
export function onWindowResize(width: number, height: number): void {
    if (composer) {
        composer.setSize(width, height);
    }
    if (c64ShaderPass) {
        c64ShaderPass.uniforms.resolution.value.set(width, height);
    }
}

// Function to trigger a game reset from UI
export async function triggerGameReset(): Promise<void> { // Make function async
    if (levelManager) {
        levelManager.resetGameState(); // Resets lives, score, level, player pos, enemies
        
        // Music restart is handled here as LevelManager might stop music on game over
        // and resetGameState doesn't automatically restart it.
        try {
            const sound = await import('../sound/sound'); // Dynamic import for sound
            sound.playStandardMusic(); 
            console.log("Game reset triggered from engine, music restarted.");
        } catch (error) {
            console.error("Error restarting music after game reset:", error);
        }
    }
    // Ensure game over screen is hidden by UI controls if not already.
    const gameOverScreen = document.getElementById('game-over-screen');
    if (gameOverScreen && !gameOverScreen.classList.contains('hidden')) {
        // This ideally should be handled by the UI that showed it,
        // but as a fallback or if reset is triggered by other means.
        // gameOverScreen.classList.add('hidden'); 
        // Decided against this here; let ui/controls.ts manage hiding it.
    }
}