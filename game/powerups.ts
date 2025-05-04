import * as THREE from 'three';

/**
 * Creates the player mesh.
 * @returns A green box representing the player.
 */
export function createPlayer(): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(-5, 0, 0);
  return mesh;
}

/**
 * Creates an array of enemy meshes.
 * @returns An array of red spheres representing enemies.
 */
export function createEnemies(): THREE.Mesh[] {
  const enemies: THREE.Mesh[] = [];
  const geometry = new THREE.SphereGeometry(0.5, 16, 16);
  const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });

  for (let i = 0; i < 2; i++) {
    const enemy = new THREE.Mesh(geometry, material);
    enemy.position.set(5 - i * 2, i % 2 === 0 ? 2 : -2, 0);
    enemies.push(enemy);
  }

  return enemies;
}