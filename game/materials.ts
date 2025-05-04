import * as THREE from 'three';

/**
 * Creates a glowing trail material for the player.
 */
export function createTrailMaterial(): THREE.LineBasicMaterial {
  return new THREE.LineBasicMaterial({
    color: 0x00ffff,
    linewidth: 2,
    transparent: true,
    opacity: 0.75
  });
}

/**
 * Creates a mesh from a given geometry and trail material.
 */
export function createTrailMesh(geometry: THREE.BufferGeometry): THREE.Line {
  const material = createTrailMaterial();
  return new THREE.Line(geometry, material);
}

/**
 * Creates a translucent material to represent claimed areas.
 */
export function createClaimedAreaMaterial(): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: 0x00ff9f,
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide
  });
}