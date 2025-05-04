import * as THREE from 'three';
import { player } from '../game/engine';

let keys: Record<string, boolean> = {};

export function initControls(canvas: HTMLCanvasElement, scene: THREE.Scene, camera: THREE.Camera): void {
  window.addEventListener('keydown', e => keys[e.key] = true);
  window.addEventListener('keyup', e => keys[e.key] = false);

  const speed = 0.1;
  function movePlayer() {
    if (keys['ArrowUp']) player.position.y += speed;
    if (keys['ArrowDown']) player.position.y -= speed;
    if (keys['ArrowLeft']) player.position.x -= speed;
    if (keys['ArrowRight']) player.position.x += speed;
    requestAnimationFrame(movePlayer);
  }

  movePlayer();
}