import * as THREE from 'three';

export let player: THREE.Mesh;

export function createScene(canvas: HTMLCanvasElement) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ canvas });
  renderer.setSize(canvas.width, canvas.height);

  const geometry = new THREE.BoxGeometry();
  const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
  player = new THREE.Mesh(geometry, material);
  scene.add(player);
  player.position.z = -5;

  return { scene, camera, renderer };
}

export function updateScene(scene: THREE.Scene) {
  // Basic update loop placeholder
}