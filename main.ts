import * as THREE from 'three';
import { initControls } from './ui/controls';
import { initTrail, updateTrail } from './game/trail';
import { createScene, updateScene, player } from './game/engine';

let scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer;
let canvas: HTMLCanvasElement;

function animate() {
  requestAnimationFrame(animate);
  updateScene(scene);
  updateTrail(scene, player.position);
  renderer.render(scene, camera);
}

window.onload = () => {
  canvas = document.querySelector('canvas')!;
  ({ scene, camera, renderer } = createScene(canvas));
  initControls(canvas, scene, camera);
  initTrail(scene);
  animate();
};