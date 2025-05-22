import * as THREE from 'three';
import { player } from './engine'; // To access player's position for AI

import { enemyMaterial, edgeMaterial } from '../materials'; // Import default enemy material and edgeMaterial

// Shared geometry for all instances of standard Enemy
const sharedEnemyGeometry = new THREE.BoxGeometry(1, 1, 1);
const sharedEnemyEdgesGeometry = new THREE.EdgesGeometry(sharedEnemyGeometry);

export interface EnemyOptions {
  position?: THREE.Vector3;
  speed?: number;
  material?: THREE.Material; // Allow passing a custom material
}

export class Enemy {
  public mesh: THREE.Mesh;
  public speed: number;
  private boundingBox: THREE.Box3;

  constructor(options: EnemyOptions = {}) {
    // Use provided material or default to enemyMaterial from materials.ts
    const materialToUse = options.material || enemyMaterial; 
    
    // Use shared geometry
    this.mesh = new THREE.Mesh(sharedEnemyGeometry, materialToUse);

    // Add edges for wireframe highlight using shared edges geometry
    const wireframe = new THREE.LineSegments(sharedEnemyEdgesGeometry, edgeMaterial);
    this.mesh.add(wireframe); // Add wireframe as a child

    this.mesh.position.copy(options.position || new THREE.Vector3(5, 5, 0)); // Default position
    this.speed = options.speed || 0.05; // Slower than player by default

    this.boundingBox = new THREE.Box3().setFromObject(this.mesh);
  }

  update(): void {
    // Basic AI: Move towards the player if within a certain range (simple chase)
    // For now, let's just make it move in a predictable pattern or stand still
    // until LevelManager is implemented to provide more complex instructions.
    
    // Example: Simple oscillation on X axis for now
    // this.mesh.position.x += Math.sin(Date.now() * 0.001) * 0.01;

    // Update bounding box
    this.boundingBox.setFromObject(this.mesh);
  }

  public getBoundingBox(): THREE.Box3 {
    return this.boundingBox;
  }

  // Basic chase logic - will be expanded
  public chasePlayer(): void {
    if (player) {
      const direction = player.position.clone().sub(this.mesh.position).normalize();
      this.mesh.position.add(direction.multiplyScalar(this.speed));
      // console.log(`Enemy at ${this.mesh.position.toArray().join(',')} chasing player at ${player.position.toArray().join(',')}`);
    }
  }
}
