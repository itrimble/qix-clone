import * as THREE from 'three';
import { Enemy, EnemyOptions } from './enemy';
import { player } from './engine'; // For collision detection
import { showFeedbackMessage, triggerScreenFlash } from '../ui/feedbackMessages';
import { playSound, stopCurrentMusic, playStandardMusic, playTenseMusic } from '../sound/sound'; // Sound system

export interface LevelConfig {
  level: number;
  enemyCount: number;
  enemyOptions?: EnemyOptions[]; // Specific options for each enemy
  pointsToNextLevel: number;
}

export class LevelManager {
  public currentLevel: number;
  public enemies: Enemy[];
  private scene: THREE.Scene; // To add/remove enemy meshes
  private levelConfigs: LevelConfig[];
  public score: number;
  private timeAccumulator: number; // For score and level progression based on time
  private isTenseMusicPlaying: boolean; // To track music state

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.currentLevel = 0; // Start at level 0, will advance to 1
    this.enemies = [];
    this.score = 0;
    this.timeAccumulator = 0;
    this.isTenseMusicPlaying = false;

    // Define level configurations
    this.levelConfigs = [
      { level: 1, enemyCount: 1, pointsToNextLevel: 100 },
      { level: 2, enemyCount: 2, pointsToNextLevel: 200 },
      { level: 3, enemyCount: 3, pointsToNextLevel: 300 },
      { level: 4, enemyCount: 4, pointsToNextLevel: 400 },
      // Add more levels as needed
    ];

    this.advanceToLevel(1); // Start the game at level 1
  }

  private spawnEnemies(config: LevelConfig): void {
    // Clear existing enemies
    this.enemies.forEach(enemy => this.scene.remove(enemy.mesh));
    this.enemies = [];

    console.log(`Spawning ${config.enemyCount} enemies for level ${config.level}`);

    for (let i = 0; i < config.enemyCount; i++) {
      const spawnPositions = [
        new THREE.Vector3(10, 10, 0),
        new THREE.Vector3(-10, -10, 0),
        new THREE.Vector3(10, -10, 0),
        new THREE.Vector3(-10, 10, 0),
        new THREE.Vector3(0, 12, 0),
        new THREE.Vector3(0, -12, 0),
        new THREE.Vector3(12, 0, 0),
        new THREE.Vector3(-12, 0, 0),
      ];
      
      let enemyOptions: EnemyOptions = {
        position: spawnPositions[i % spawnPositions.length], // Cycle through spawn positions
        speed: 0.03 + (config.level * 0.005) // Increase speed slightly with level
      };

      // Allow specific options if provided in config
      if (config.enemyOptions && config.enemyOptions[i]) {
        enemyOptions = { ...enemyOptions, ...config.enemyOptions[i] };
      }
      
      const enemy = new Enemy(enemyOptions);
      this.enemies.push(enemy);
      this.scene.add(enemy.mesh);
      console.log(`Enemy ${i+1} spawned at ${enemy.mesh.position.x}, ${enemy.mesh.position.y}`);
    }
  }

  public advanceToLevel(levelNumber: number): boolean {
    const config = this.levelConfigs.find(c => c.level === levelNumber);
    if (config) {
      this.currentLevel = levelNumber;
      console.log(`Advancing to Level ${this.currentLevel}`);
      const levelDisplayElement = document.getElementById('level-display');
      if (levelDisplayElement) levelDisplayElement.textContent = `Level: ${this.currentLevel}`;
      
      // Show level up message only if it's not the initial load (level 1)
      if (this.currentLevel > 1 || (this.currentLevel === 1 && this.score > 0)) { // Avoid on very first game start
        showFeedbackMessage(`Level ${this.currentLevel}!`, 2000);
        playSound('levelUp', 0.6); // Play level up sound effect
      }

      this.spawnEnemies(config);
      // Potentially switch music back to standard if a tense situation ended by leveling up
      if (this.isTenseMusicPlaying) {
        playStandardMusic();
        this.isTenseMusicPlaying = false;
      }
      return true;
    } else {
      console.log(`Level ${levelNumber} configuration not found. Max level reached?`);
      const levelDisplayElement = document.getElementById('level-display');
      if (levelDisplayElement) levelDisplayElement.textContent = `Max Level Reached!`;
      showFeedbackMessage("Max Level Reached!", 3000);
      // Potentially stop music or play a specific "game complete" track
      // stopCurrentMusic(); 
      return false;
    }
  }

  update(deltaTime: number): void {
    this.timeAccumulator += deltaTime;

    // Update score (e.g., 1 point per second)
    if (this.timeAccumulator >= 1) {
      this.score += Math.floor(this.timeAccumulator);
      this.timeAccumulator -= Math.floor(this.timeAccumulator); // Keep the fractional part
      // console.log(`Score: ${this.score}`);
      const scoreElement = document.getElementById('score');
      if (scoreElement) scoreElement.textContent = `Score: ${this.score}`;
    }

    // Update enemies
    this.enemies.forEach(enemy => {
      enemy.update(); // General updates
      enemy.chasePlayer(); // Specific AI behavior
    });

    // Check for level advancement based on score
    const currentConfig = this.levelConfigs.find(c => c.level === this.currentLevel);
    if (currentConfig && this.score >= currentConfig.pointsToNextLevel) {
      this.advanceToLevel(this.currentLevel + 1);
    }
    
    // Placeholder for collision detection logic
    this.checkCollisions();
    this.checkTenseConditions(); // Check and manage tense music
  }
  
  private checkCollisions(): void {
    if (!player) return;

    const playerBox = new THREE.Box3().setFromObject(player);

    for (const enemy of this.enemies) {
      if (playerBox.intersectsBox(enemy.getBoundingBox())) {
        console.log('Collision detected with enemy!');
        player.position.set(0, 0, 0); // Reset player position

        const currentConfig = this.levelConfigs.find(c => c.level === this.currentLevel);
        if (currentConfig && this.currentLevel > 1) {
            const prevConfig = this.levelConfigs.find(c => c.level === this.currentLevel -1);
            this.score = prevConfig ? prevConfig.pointsToNextLevel : 0;
        } else {
            this.score = 0;
        }
        const scoreElement = document.getElementById('score');
        if (scoreElement) scoreElement.textContent = `Score: ${this.score}`;
        
        showFeedbackMessage("COLLISION!", 1500);
        triggerScreenFlash();
        stopCurrentMusic(); // Stop music on collision
        playSound('collision', 0.8); // Play collision sound (mapped to bomb.wav)
        // After a delay, standard music could resume if game continues
        setTimeout(() => {
            if (!this.isTenseMusicPlaying) playStandardMusic(); // Or based on tense state
        }, 2000); // Delay before resuming music

        break; 
      }
    }
  }

  private checkTenseConditions(): void {
    if (!player || this.enemies.length === 0) {
      if (this.isTenseMusicPlaying) {
        playStandardMusic();
        this.isTenseMusicPlaying = false;
      }
      return;
    }

    const TENSE_DISTANCE_THRESHOLD = 7; // Player distance to an enemy
    const MIN_ENEMIES_FOR_TENSION = 2; // Number of enemies nearby to trigger tense music
    let nearbyEnemies = 0;

    for (const enemy of this.enemies) {
      const distanceToPlayer = player.position.distanceTo(enemy.mesh.position);
      if (distanceToPlayer < TENSE_DISTANCE_THRESHOLD) {
        nearbyEnemies++;
      }
    }

    if (nearbyEnemies >= MIN_ENEMIES_FOR_TENSION) {
      if (!this.isTenseMusicPlaying) {
        console.log("Tense situation detected! Playing tense music.");
        playTenseMusic();
        this.isTenseMusicPlaying = true;
      }
    } else {
      if (this.isTenseMusicPlaying) {
        console.log("Tense situation resolved. Playing standard music.");
        playStandardMusic();
        this.isTenseMusicPlaying = false;
      }
    }
  }

  public getCurrentScore(): number {
    return this.score;
  }

  public getCurrentLevel(): number {
    return this.currentLevel;
  }
}
