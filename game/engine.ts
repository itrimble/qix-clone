import * as THREE from 'three';
import { createStarfield, createNebulaGradient } from './backgrounds';
import { keys } from '../ui/controls';
import { BASE_PLAYER_SPEED, GRID_LIMIT } from './config';

// Re-export for backward compatibility
export { BASE_PLAYER_SPEED };
export const gridLimit = GRID_LIMIT;

// Global variables
export let player: THREE.Mesh;

// C64 retro mode state
let c64ModeEnabled = false;

// Game reset callback (set by main.ts)
let gameResetCallback: (() => Promise<void>) | null = null;

export function setGameResetCallback(callback: () => Promise<void>): void {
  gameResetCallback = callback;
}

export function saveGameState(): void {
  try {
    const gameState = {
      playerPosition: player ? { x: player.position.x, y: player.position.y, z: player.position.z } : null,
      c64Mode: c64ModeEnabled,
      timestamp: Date.now()
    };
    localStorage.setItem('qix_game_state', JSON.stringify(gameState));
    console.log('Game state saved');
  } catch (e) {
    console.error('Error saving game state:', e);
  }
}

export function toggleC64Mode(): void {
  c64ModeEnabled = !c64ModeEnabled;
  document.body.classList.toggle('c64-mode', c64ModeEnabled);
  console.log(`C64 Retro mode: ${c64ModeEnabled ? 'ON' : 'OFF'}`);
}

export async function triggerGameReset(): Promise<void> {
  if (gameResetCallback) {
    await gameResetCallback();
  } else {
    console.warn('No game reset callback registered');
  }
}

export function createScene(canvas: HTMLCanvasElement) {
  console.log('Creating scene...');
  
  // Create scene
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000); // Ensure black background
  
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
  
  // Add lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambientLight);
  
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
  directionalLight.position.set(1, 1, 1).normalize();
  scene.add(directionalLight);
  
  // Add grid for reference - using a flat grid on XY plane
  const gridSize = 30;
  const gridDivisions = 30;
  const gridHelper = new THREE.GridHelper(gridSize, gridDivisions, 0x00ffff, 0x004444);
  gridHelper.rotation.x = Math.PI / 2; // Rotate to XY plane
  scene.add(gridHelper);

  // Add prominent boundary rectangle (classic Qix style)
  const boundaryPoints = [
    new THREE.Vector3(-gridLimit, -gridLimit, 0.1),
    new THREE.Vector3(gridLimit, -gridLimit, 0.1),
    new THREE.Vector3(gridLimit, gridLimit, 0.1),
    new THREE.Vector3(-gridLimit, gridLimit, 0.1),
    new THREE.Vector3(-gridLimit, -gridLimit, 0.1), // Close the loop
  ];
  const boundaryGeometry = new THREE.BufferGeometry().setFromPoints(boundaryPoints);
  const boundaryMaterial = new THREE.LineBasicMaterial({
    color: 0x00ffff,
    linewidth: 2 // Note: linewidth > 1 only works on some systems
  });
  const boundaryLine = new THREE.Line(boundaryGeometry, boundaryMaterial);
  scene.add(boundaryLine);
  
  // Add background elements
  const starfield = createStarfield(1000);
  scene.add(starfield);
  
  // Create player as 3D diamond (octahedron) - classic Qix style
  const geometry = new THREE.OctahedronGeometry(1.2, 0);
  const material = new THREE.MeshPhongMaterial({
    color: 0x00ffff, // Cyan like classic Qix
    emissive: 0x004444, // Subtle glow
    shininess: 80
  });
  player = new THREE.Mesh(geometry, material);

  // Add wireframe edges for visual clarity
  const edges = new THREE.EdgesGeometry(geometry);
  const edgeMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
  const wireframe = new THREE.LineSegments(edges, edgeMaterial);
  player.add(wireframe);

  scene.add(player);
  
  // Move player to a visible starting position
  player.position.set(0, 0, 0);
  
  console.log('Scene created with player at', player.position);
  
  return { scene, camera, renderer };
}

export function updateScene(scene: THREE.Scene, speedMultiplier: number): void {
  // Handle player movement
  const currentSpeed = BASE_PLAYER_SPEED * speedMultiplier;
  
  // Key state is now handled without verbose logging for performance
  
  // Move player based on keyboard input
  if (keys['arrowup'] || keys['ArrowUp'] || keys['w']) {
    player.position.y += currentSpeed;
    // console.log('Moving UP', player.position.y); // Reduced verbosity
  }
  if (keys['arrowdown'] || keys['ArrowDown'] || keys['s']) {
    player.position.y -= currentSpeed;
    // console.log('Moving DOWN', player.position.y);
  }
  if (keys['arrowleft'] || keys['ArrowLeft'] || keys['a']) {
    player.position.x -= currentSpeed;
    // console.log('Moving LEFT', player.position.x);
  }
  if (keys['arrowright'] || keys['ArrowRight'] || keys['d']) {
    player.position.x += currentSpeed;
    // console.log('Moving RIGHT', player.position.x);
  }
  
  // Smooth rotation for diamond player
  player.rotation.y += 0.02;
  player.rotation.z += 0.005;
  
  // Limit player movement to the grid
  player.position.x = Math.max(-gridLimit, Math.min(gridLimit, player.position.x));
  player.position.y = Math.max(-gridLimit, Math.min(gridLimit, player.position.y));
}