import * as THREE from 'three';
import { createTrailMaterial } from './materials';

// Trail state
let trailPoints: THREE.Vector3[] = [];
let trailLine: THREE.Line | null = null;
let trailMaterial: THREE.LineBasicMaterial;

/**
 * Initializes the player's trail system.
 */
export function initTrail(scene: THREE.Scene): void {
  // Clear any existing points
  trailPoints = [];
  
  // Get trail material
  trailMaterial = createTrailMaterial();
  
  // Create empty geometry for the trail
  const geometry = new THREE.BufferGeometry();
  
  // Create an empty buffer attribute
  const positions = new Float32Array(0);
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  
  // Create the line and add it to the scene
  trailLine = new THREE.Line(geometry, trailMaterial);
  scene.add(trailLine);
  
  console.log('Trail initialized');
}

/**
 * Updates the trail with a new point.
 */
export function updateTrail(scene: THREE.Scene, newPoint: THREE.Vector3): void {
  // Add the new point to our points array
  trailPoints.push(newPoint.clone());
  
  // Limit trail length to prevent performance issues
  if (trailPoints.length > 500) {
    trailPoints.shift(); // Remove oldest point
  }
  
  // Create a new array for the updated positions
  const positions = new Float32Array(trailPoints.length * 3);
  
  // Fill the positions array with our points
  for (let i = 0; i < trailPoints.length; i++) {
    positions[i * 3] = trailPoints[i].x;
    positions[i * 3 + 1] = trailPoints[i].y;
    positions[i * 3 + 2] = trailPoints[i].z;
  }
  
  // Update the line geometry
  trailLine.geometry.dispose(); // Clean up old geometry
  trailLine.geometry = new THREE.BufferGeometry();
  trailLine.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
}

/**
 * Clears the trail from the scene.
 */
export function clearTrail(scene: THREE.Scene): void {
  if (trailLine) {
    scene.remove(trailLine);
    trailLine.geometry.dispose();
    trailLine = null;
  }
  trailPoints = [];
}

/**
 * Returns a copy of the current trail points.
 */
export function getTrailPoints(): THREE.Vector3[] {
  return trailPoints.map(p => p.clone());
}