import * as THREE from 'three';
let trail: THREE.Line | null = null;
let trailPoints: THREE.Vector3[] = [];

export function initTrail(scene: THREE.Scene) {
  const geometry = new THREE.BufferGeometry();
  const material = new THREE.LineBasicMaterial({ color: 0x00ffff });
  trail = new THREE.Line(geometry, material);
  scene.add(trail);
}

export function updateTrail(scene: THREE.Scene, point: THREE.Vector3) {
  if (!trail) return;
  trailPoints.push(point.clone());
  const positions = new Float32Array(trailPoints.length * 3);
  for (let i = 0; i < trailPoints.length; i++) {
    positions.set([trailPoints[i].x, trailPoints[i].y, trailPoints[i].z], i * 3);
  }
  trail.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  trail.geometry.setDrawRange(0, trailPoints.length);
}