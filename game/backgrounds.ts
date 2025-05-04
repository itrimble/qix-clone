
import * as THREE from 'three';

export function createStarfield(count = 500) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 2000;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 2000;
    positions[i * 3 + 2] = -500 + Math.random() * -500;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    size: 2,
    color: 0x8888ff,
    blending: THREE.AdditiveBlending,
    transparent: true
  });

  return new THREE.Points(geometry, material);
}

export function createNebulaGradient() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(128, 128, 32, 128, 128, 128);
  gradient.addColorStop(0, '#ff33cc');
  gradient.addColorStop(0.5, '#6622ee');
  gradient.addColorStop(1, 'black');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.MeshBasicMaterial({ map: texture, depthTest: false, transparent: true });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), material);
  mesh.position.z = -1000;
  return mesh;
}
