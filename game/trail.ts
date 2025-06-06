import * as THREE from 'three';
import { createTrailMaterial } from './materials';

const MAX_TRAIL_POINTS = 500;

// Module-scoped variables for the trail state
let trailPoints: THREE.Vector3[] = []; // Stores the Vector3 points for easy access/copying
let trailLine: THREE.Line | null = null;
let trailMaterial: THREE.LineBasicMaterial;
let currentTrailLength = 0; // Number of points currently in the trail
let positionBuffer: Float32Array | null = null; // The actual buffer for THREE.js

export function initTrail(scene: THREE.Scene): void {
  trailPoints = [];
  currentTrailLength = 0;
  trailMaterial = createTrailMaterial();

  const geometry = new THREE.BufferGeometry();
  positionBuffer = new Float32Array(MAX_TRAIL_POINTS * 3); // x, y, z for each point

  geometry.setAttribute('position', new THREE.BufferAttribute(positionBuffer, 3));
  geometry.setDrawRange(0, 0); // Initially draw nothing

  trailLine = new THREE.Line(geometry, trailMaterial);
  scene.add(trailLine);

  console.log('Trail initialized with pre-allocated buffer.');
}

export function updateTrail(scene: THREE.Scene, newPoint: THREE.Vector3): void {
  if (!trailLine || !positionBuffer) {
    console.warn('Trail not initialized, cannot update.');
    return;
  }

  if (currentTrailLength < MAX_TRAIL_POINTS) {
    trailPoints.push(newPoint.clone());

    positionBuffer[currentTrailLength * 3] = newPoint.x;
    positionBuffer[currentTrailLength * 3 + 1] = newPoint.y;
    positionBuffer[currentTrailLength * 3 + 2] = newPoint.z;
    currentTrailLength++;
  } else {
    trailPoints.shift();
    trailPoints.push(newPoint.clone());

    for (let i = 0; i < MAX_TRAIL_POINTS; i++) {
      positionBuffer[i * 3] = trailPoints[i].x;
      positionBuffer[i * 3 + 1] = trailPoints[i].y;
      positionBuffer[i * 3 + 2] = trailPoints[i].z;
    }
  }

  trailLine.geometry.attributes.position.needsUpdate = true;
  trailLine.geometry.setDrawRange(0, currentTrailLength);
}

export function clearTrailPoints(): void {
  trailPoints = [];
  currentTrailLength = 0;
  if (trailLine) {
    trailLine.geometry.setDrawRange(0, 0);
  }
   console.log('Trail points cleared, draw range set to 0.');
}

export function destroyTrail(scene: THREE.Scene): void {
  if (trailLine) {
    scene.remove(trailLine);
    trailLine.geometry.dispose();
    trailLine = null;
  }
  trailPoints = [];
  currentTrailLength = 0;
  positionBuffer = null;
  console.log('Trail destroyed and removed from scene.');
}

export function getTrailPoints(): THREE.Vector3[] {
  return trailPoints.slice(0, currentTrailLength).map(p => p.clone());
}

export function clearTrail(scene: THREE.Scene): void {
  destroyTrail(scene);
}