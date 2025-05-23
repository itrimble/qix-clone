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
  public lives: number; // Player lives

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.currentLevel = 0; // Start at level 0, will advance to 1
    this.enemies = [];
    this.score = 0;
    this.timeAccumulator = 0;
    this.isTenseMusicPlaying = false;
    this.lives = 3; // Initialize lives
    this.updateLivesDisplay(); // Update HUD on initial load

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
    // Check for game over before other updates if lives are zero
    if (this.lives <= 0) {
        // Gameplay is effectively paused if lives are zero.
        // Music and tense condition checks are also halted via checks in their respective functions.
        return; 
    }

    this.timeAccumulator += deltaTime;

    // Update score (e.g., 1 point per second)
    if (this.timeAccumulator >= 1) {
      this.score += Math.floor(this.timeAccumulator);
      this.timeAccumulator -= Math.floor(this.timeAccumulator); // Keep the fractional part
      this.updateScoreDisplay();
    }

    // Update enemies
    this.enemies.forEach(enemy => {
      enemy.update(); 
      enemy.chasePlayer(); 
    });

    // Check for level advancement based on score
    const currentConfig = this.levelConfigs.find(c => c.level === this.currentLevel);
    if (currentConfig && this.score >= currentConfig.pointsToNextLevel) {
      this.advanceToLevel(this.currentLevel + 1);
    }
    
    this.checkCollisions();
    this.checkTenseConditions(); 
  }

  private updateScoreDisplay(): void {
    const scoreElement = document.getElementById('score');
    if (scoreElement) {
      scoreElement.textContent = `Score: ${this.score}`;
    }
  }

  private updateLivesDisplay(): void {
    const livesElement = document.getElementById('lives');
    if (livesElement) {
      livesElement.textContent = `Lives: ${this.lives}`;
    }
  }
  
  private checkCollisions(): void {
    if (!player || this.lives <= 0) return; // Don't check collisions if game over

    const playerBox = new THREE.Box3().setFromObject(player);

    for (const enemy of this.enemies) {
      if (playerBox.intersectsBox(enemy.getBoundingBox())) {
        console.log('Collision detected! Lives remaining:', this.lives - 1);
        this.lives--;
        this.updateLivesDisplay();
        
        player.position.set(0, 0, 0); // Reset player position

        // Score penalty only if not game over
        if (this.lives > 0) {
            const currentConfig = this.levelConfigs.find(c => c.level === this.currentLevel);
            if (currentConfig && this.currentLevel > 1) {
                const prevConfig = this.levelConfigs.find(c => c.level === this.currentLevel -1);
                this.score = prevConfig ? prevConfig.pointsToNextLevel : 0;
            } else {
                this.score = 0;
            }
            const scoreElement = document.getElementById('score');
            if (scoreElement) scoreElement.textContent = `Score: ${this.score}`;
            
            showFeedbackMessage("OUCH!", 1500); // Changed message
            triggerScreenFlash();
            stopCurrentMusic(); 
            playSound('collision', 0.8); 
            setTimeout(() => {
                if (this.lives > 0 && !this.isTenseMusicPlaying) playStandardMusic();
            }, 2000);
        } else {
            // Game Over logic
            console.log(`Game Over! Final Score: ${this.score}`);
            // showFeedbackMessage(`GAME OVER! Score: ${this.score}`, 5000); // Replaced by actual screen
            stopCurrentMusic();
            playSound('gameover', 0.9); 
            
            // Show Game Over Screen
            const gameOverScreen = document.getElementById('game-over-screen');
            const finalScoreElement = document.getElementById('final-score');
            if (finalScoreElement && gameOverScreen) {
                finalScoreElement.textContent = String(this.score);
                gameOverScreen.classList.remove('hidden');
            }
        }
        break; 
      }
    }
  }

  private checkTenseConditions(): void {
    if (this.lives <= 0) { // Don't change music if game over
        if (this.isTenseMusicPlaying) { // Ensure standard music isn't triggered if tense music was on
             stopCurrentMusic(); // Or let it fade if preferred for game over screen
        }
        this.isTenseMusicPlaying = false; // Stop further tense checks
        return;
    }
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

  public getCurrentLives(): number { // Getter for lives
    return this.lives;
  }

  public resetGameState(): void {
    this.lives = 3;
    this.score = 0;
    this.currentLevel = 0; // Will be set to 1 by advanceToLevel
    this.timeAccumulator = 0;
    this.isTenseMusicPlaying = false;

    this.updateLivesDisplay();
    this.updateScoreDisplay();
    
    if(player) player.position.set(0,0,0); // Reset player position

    this.advanceToLevel(1); // This will also handle initial enemy spawn & level display
    
    // Ensure tense music state is reset and standard music plays if needed (handled by advanceToLevel and checkTenseConditions)
    // If music was stopped by game over, it will be restarted by playStandardMusic() call from UI/restart logic
    console.log("Game state reset.");
  }
}
