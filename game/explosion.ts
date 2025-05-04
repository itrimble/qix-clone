
import * as THREE from 'three';

export function triggerExplosion(scene: THREE.Scene, position: THREE.Vector3) {
  const particles: THREE.Mesh[] = [];
  const count = 20;
  const geometry = new THREE.SphereGeometry(3, 6, 6);
  const material = new THREE.MeshBasicMaterial({ color: 0xff5500 });

  for (let i = 0; i < count; i++) {
    const mesh = new THREE.Mesh(geometry, material.clone());
    mesh.position.copy(position);
    mesh.userData.velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 6,
      (Math.random() - 0.5) * 6,
      0
    );
    scene.add(mesh);
    particles.push(mesh);
  }

  let frames = 0;
  function animate() {
    frames++;
    particles.forEach((p) => {
      p.position.add(p.userData.velocity);
      (p.material as THREE.MeshBasicMaterial).opacity = 1 - frames / 30;
      (p.material as THREE.MeshBasicMaterial).transparent = true;
    });
    if (frames < 30) {
      requestAnimationFrame(animate);
    } else {
      particles.forEach((p) => {
        scene.remove(p);
        p.geometry.dispose();
        (p.material as THREE.Material).dispose();
      });
    }
  }

  animate();
}
