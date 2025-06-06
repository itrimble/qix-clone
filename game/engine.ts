import * as THREE from 'three';
import { createStarfield, createNebulaGradient } from './backgrounds';
import { keys } from '../ui/controls';

export const BASE_PLAYER_SPEED = 0.25;
export const gridLimit = 14; // Slightly less than grid size/2

// Global variables
export let player: THREE.Mesh;

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
  
  // Add background elements
  const starfield = createStarfield(1000);
  scene.add(starfield);
  
  // Create player cube - make it larger and more visible
  const geometry = new THREE.BoxGeometry(2, 2, 2);
  const material = new THREE.MeshPhongMaterial({ 
    color: 0x00ff00,
    emissive: 0x003300, // Slight glow
    shininess: 30
  });
  player = new THREE.Mesh(geometry, material);
  scene.add(player);
  
  // Move player to a visible starting position
  player.position.set(0, 0, 0);
  
  console.log('Scene created with player at', player.position);
  
  return { scene, camera, renderer };
}

export function updateScene(scene: THREE.Scene, speedMultiplier: number): void {
  // Handle player movement
  const currentSpeed = BASE_PLAYER_SPEED * speedMultiplier;
  
  // Verbose debugging when keys are pressed
  const activeKeys = Object.entries(keys).filter(([k, v]) => v).map(([k]) => k);
  if (activeKeys.length > 0) {
    console.log('Active keys:', activeKeys.join(', '));
  }
  
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
  
  // Add a small rotation to the player for visual feedback
  player.rotation.x += 0.01;
  player.rotation.y += 0.01;
  
  // Limit player movement to the grid
  player.position.x = Math.max(-gridLimit, Math.min(gridLimit, player.position.x));
  player.position.y = Math.max(-gridLimit, Math.min(gridLimit, player.position.y));
}