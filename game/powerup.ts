// game/powerup.ts
import * as THREE from 'three';
import { QixEnemy } from './qix_enemy'; // Assuming QixEnemy will be passed in gameTargets
// We might need to pass player object or relevant parts of gameState as well.
// For now, define a generic structure for gameTargets.
export interface GameTargets {
  playerMesh?: THREE.Mesh; // The player's visual object
  playerSpeedMultiplier?: { value: number }; // A way to modify player speed
  qix?: QixEnemy;
  gameState?: any; // For score, lives etc. if powerups affect them
  scene?: THREE.Scene; // To add/remove temporary effects tied to powerup
}

export enum PowerUpType {
  FREEZE_QIX = 'FREEZE_QIX',
  PLAYER_SPEED_BOOST = 'PLAYER_SPEED_BOOST',
  // Add other types here in the future
}

export abstract class PowerUp {
  public id: string;
  public type: PowerUpType;
  public mesh: THREE.Mesh; // To be created by subclass constructor
  public position: THREE.Vector2; // Logical 2D position

  public durationSeconds: number; // Total duration of the effect
  public remainingEffectSeconds: number;
  public isEffectActive: boolean;
  public isAvailableForCollection: boolean;

  constructor(
    type: PowerUpType,
    position: THREE.Vector2,
    durationSeconds: number,
    mesh: THREE.Mesh // Subclasses will create and pass their mesh
  ) {
    this.id = THREE.MathUtils.generateUUID();
    this.type = type;
    this.position = position.clone();
    this.durationSeconds = durationSeconds;
    this.mesh = mesh; // Mesh is created by subclass and passed here
    this.mesh.position.set(this.position.x, this.position.y, 0);

    this.remainingEffectSeconds = 0;
    this.isEffectActive = false;
    this.isAvailableForCollection = true; // Assumes it's spawned on board
  }

  // Abstract methods to be implemented by specific power-up types
  public abstract applyEffect(targets: GameTargets): void;
  public abstract removeEffect(targets: GameTargets): void;

  // Common update logic for duration countdown
  public update(deltaTime: number, targets: GameTargets): void {
    if (this.isEffectActive) {
      this.remainingEffectSeconds -= deltaTime;
      if (this.remainingEffectSeconds <= 0) {
        this.removeEffect(targets);
        this.isEffectActive = false;
        console.log(`Power-up ${this.type} effect expired.`);
        // This instance might be removed from an active effects list elsewhere
      }
    }
  }

  // Call this when player collects the power-up
  public collect(scene: THREE.Scene, targets: GameTargets): void {
    if (!this.isAvailableForCollection) return;

    this.isAvailableForCollection = false;
    this.isEffectActive = true;
    this.remainingEffectSeconds = this.durationSeconds;

    if (this.mesh) {
      scene.remove(this.mesh); // Remove from scene
      // Optionally dispose geometry/material if not reused:
      // this.mesh.geometry.dispose();
      // if(Array.isArray(this.mesh.material)) { this.mesh.material.forEach(m => m.dispose()); } else { this.mesh.material.dispose(); }
    }

    console.log(`Collected power-up: ${this.type}`);
    this.applyEffect(targets);
  }

  // Call this to clean up the power-up entirely if it expires on map or for other reasons
  public destroy(scene: THREE.Scene): void {
      if (this.mesh && this.isAvailableForCollection) { // If it was on map and not collected
          scene.remove(this.mesh);
          // Dispose geo/mat
      }
      this.isAvailableForCollection = false;
      // Further cleanup if this instance is held in lists etc.
  }
}

export class FreezeQixPowerUp extends PowerUp {
  constructor(position: THREE.Vector2, scene: THREE.Scene) { // scene might not be needed if mesh is added externally post-creation
    const duration = 5.0; // seconds
    const size = 0.7; // Slightly smaller than player/other objects
    const geometry = new THREE.SphereGeometry(size / 2, 16, 16);
    const material = new THREE.MeshPhongMaterial({ color: 0x00ccff, emissive: 0x0055cc }); // Light blue / cyan
    const mesh = new THREE.Mesh(geometry, material);

    super(PowerUpType.FREEZE_QIX, position, duration, mesh);
  }

  public applyEffect(targets: GameTargets): void {
    if (targets.qix) {
      targets.qix.isFrozen = true;
      console.log("Qix FROZEN!");
      // Optionally, if Qix has visual state for frozen, set it here
    }
  }

  public removeEffect(targets: GameTargets): void {
    if (targets.qix) {
      targets.qix.isFrozen = false;
      console.log("Qix unfrozen.");
      // Optionally, revert visual state
    }
  }
}

export class PlayerSpeedBoostPowerUp extends PowerUp {
  private originalPlayerColorHolder: THREE.Color | null = null;

  constructor(position: THREE.Vector2) { // Removed scene from constructor, as mesh is added by spawner
    const duration = 7.0; // seconds
    const size = 0.7;
    const geometry = new THREE.BoxGeometry(size, size, size);
    // Green color for speed boost powerup item itself
    const material = new THREE.MeshPhongMaterial({ color: 0x00ff00, emissive: 0x005500 });
    const mesh = new THREE.Mesh(geometry, material);

    super(PowerUpType.PLAYER_SPEED_BOOST, position, duration, mesh);
  }

  public applyEffect(targets: GameTargets): void {
    if (targets.playerSpeedMultiplier) {
      targets.playerSpeedMultiplier.value = 2.0; // Double speed
      console.log("Player Speed Boost ACTIVE!");
    }
    if (targets.playerMesh && targets.playerMesh.material) {
      // Assuming MeshPhongMaterial for simplicity to change color
      // Also ensure material has a 'color' property.
      const playerMaterial = targets.playerMesh.material as THREE.MeshPhongMaterial;
      if (playerMaterial.color) {
        this.originalPlayerColorHolder = playerMaterial.color.clone();
        playerMaterial.color.setHex(0xffff00); // Change player to yellow while active
      }
    }
  }

  public removeEffect(targets: GameTargets): void {
    if (targets.playerSpeedMultiplier) {
      targets.playerSpeedMultiplier.value = 1.0; // Reset speed
      console.log("Player Speed Boost EXPIRED!");
    }
    if (targets.playerMesh && targets.playerMesh.material && this.originalPlayerColorHolder) {
      const playerMaterial = targets.playerMesh.material as THREE.MeshPhongMaterial;
      if (playerMaterial.color) {
        playerMaterial.color.copy(this.originalPlayerColorHolder); // Revert to original color
      }
      this.originalPlayerColorHolder = null;
    }
  }
}
