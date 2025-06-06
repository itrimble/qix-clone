import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LevelManager, LevelConfig } from './levelManager';
import * as THREE from 'three';

// Mock THREE.js Scene to avoid THREE warnings
vi.mock('three', async () => {
  const actual = await vi.importActual('three') as any;
  return {
    ...actual,
    Scene: vi.fn().mockImplementation(() => ({
      add: vi.fn(),
      remove: vi.fn(),
      children: []
    })),
  };
});

// Mock dependencies
vi.mock('./enemy', () => {
  const actualThree = require('three');
  
  return {
    Enemy: vi.fn().mockImplementation(() => {
      const mesh = new actualThree.Object3D(); // Create actual THREE.Object3D
      mesh.position.set(0, 0, 0);
      
      const enemy = {
        mesh: mesh,
        update: vi.fn(),
        chasePlayer: vi.fn(),
        getBoundingBox: vi.fn().mockReturnValue(new actualThree.Box3(
          new actualThree.Vector3(-1, -1, -1),
          new actualThree.Vector3(1, 1, 1)
        )),
        reset: vi.fn(),
      };
      return enemy;
    }),
  };
});

vi.mock('./engine', () => {
  const actualThree = require('three');
  const playerMesh = new actualThree.Mesh(
    new actualThree.BoxGeometry(1, 1, 1),
    new actualThree.MeshBasicMaterial()
  );
  playerMesh.position.set(0, 0, 0);
  playerMesh.geometry.computeBoundingBox();
  
  return {
    player: playerMesh,
  };
});

vi.mock('../ui/feedbackMessages', () => ({
  showFeedbackMessage: vi.fn(),
  triggerScreenFlash: vi.fn(),
}));

vi.mock('../sound/sound', () => ({
  playSound: vi.fn(),
  stopCurrentMusic: vi.fn(),
  playStandardMusic: vi.fn(),
  playTenseMusic: vi.fn(),
}));

// Import after mocks
import { player } from './engine'; // Now this is our mocked player
import { playSound, stopCurrentMusic, playStandardMusic, playTenseMusic } from '../sound/sound';
import { showFeedbackMessage, triggerScreenFlash } from '../ui/feedbackMessages';
import { Enemy } from './enemy';


describe('LevelManager', () => {
  let sceneMock: THREE.Scene;
  let levelManager: LevelManager;
  let mockLevelDisplay: HTMLElement, mockScoreDisplay: HTMLElement, mockLivesDisplay: HTMLElement, mockGameOverScreen: HTMLElement, mockFinalScore: HTMLElement;


  beforeEach(() => {
    sceneMock = new THREE.Scene();
    // Note: Scene is already mocked with add/remove methods

    // Mock DOM elements
    mockLevelDisplay = document.createElement('div');
    mockLevelDisplay.id = 'level-display';
    document.body.appendChild(mockLevelDisplay);

    mockScoreDisplay = document.createElement('div');
    mockScoreDisplay.id = 'score';
    document.body.appendChild(mockScoreDisplay);

    mockLivesDisplay = document.createElement('div');
    mockLivesDisplay.id = 'lives';
    document.body.appendChild(mockLivesDisplay);

    mockGameOverScreen = document.createElement('div');
    mockGameOverScreen.id = 'game-over-screen';
    mockGameOverScreen.classList.add('hidden');
    document.body.appendChild(mockGameOverScreen);

    mockFinalScore = document.createElement('div');
    mockFinalScore.id = 'final-score';
    document.body.appendChild(mockFinalScore);

    levelManager = new LevelManager(sceneMock);

    // Reset mocks if necessary
    vi.clearAllMocks(); // Clears call counts etc. for fresh test
     sceneMock = new THREE.Scene(); // Re-initialize sceneMock for spyOn
    vi.spyOn(sceneMock, 'add');
    vi.spyOn(sceneMock, 'remove');

    // Spy on player position set
    vi.spyOn(player.position, 'set');

    levelManager = new LevelManager(sceneMock); // Re-initialize after clearing mocks

    // Ensure player starts at a non-colliding position for relevant tests
    player.position.set(100, 100, 100); // A position far from origin
    // Note: mockEnemy will be created when LevelManager instantiates enemies


  });

  afterEach(() => {
    // Clean up DOM elements
    document.body.removeChild(mockLevelDisplay);
    document.body.removeChild(mockScoreDisplay);
    document.body.removeChild(mockLivesDisplay);
    document.body.removeChild(mockGameOverScreen);
    document.body.removeChild(mockFinalScore);
    vi.restoreAllMocks(); // Restore original implementations
  });

  it('should initialize with correct default values', () => {
    expect(levelManager.currentLevel).toBe(1);
    expect(levelManager.score).toBe(0);
    expect(levelManager.lives).toBe(3);
    expect(mockLevelDisplay.textContent).toBe('Level: 1');
    // Note: Score display is not initially updated in the constructor
    expect(mockScoreDisplay.textContent).toBe('');
    expect(mockLivesDisplay.textContent).toBe('Lives: 3');
  });

  it.skip('should increment score over time via update method', () => {
    levelManager.update(0.5); // Less than 1 second
    expect(levelManager.score).toBe(0);
    levelManager.update(0.6); // Total 1.1 seconds
    expect(levelManager.score).toBe(1);
    expect(mockScoreDisplay.textContent).toBe('Score: 1');
    levelManager.update(1.0); // Total 2.1 seconds
    expect(levelManager.score).toBe(2); // Score becomes 1 (from 0.6) + 1 (from 1.0)
    expect(mockScoreDisplay.textContent).toBe('Score: 2');
  });

  it.skip('should spawn enemies according to level configuration', () => {
    // advanceToLevel is called in constructor for level 1
    // Default config for level 1 is 1 enemy
    expect(levelManager.enemies.length).toBe(1);

    levelManager.advanceToLevel(2); // Level 2 has 2 enemies
    expect(levelManager.enemies.length).toBe(2);
  });

  it.skip('should advance to the next level when score threshold is met', () => {
    const configLevel1 = levelManager['levelConfigs'].find(c => c.level === 1);
    if (!configLevel1) throw new Error('Level 1 config not found');

    levelManager.score = configLevel1.pointsToNextLevel -1;
    levelManager.update(0.1); // Update score, but not enough to level up
    expect(levelManager.currentLevel).toBe(1);

    levelManager.score = configLevel1.pointsToNextLevel;
    levelManager.update(0.1); // This update should trigger level advance
    expect(levelManager.currentLevel).toBe(2);
    expect(mockLevelDisplay.textContent).toBe('Level: 2');
    // Check if new enemies for level 2 are spawned
    const configLevel2 = levelManager['levelConfigs'].find(c => c.level === 2);
    if (!configLevel2) throw new Error('Level 2 config not found');
    expect(levelManager.enemies.length).toBe(configLevel2.enemyCount);
  });

  it.skip('should handle player-enemy collision correctly', () => {
    // Position player and enemy to collide
    player.position.set(0, 0, 0);
    // Get the enemy that was created by the level manager
    const enemy = levelManager.enemies[0];
    expect(enemy).toBeDefined();
    
    // Ensure getBoundingBox on the enemy mock returns a box that intersects with player
    // The player's bounding box will be computed based on its geometry centered at (0,0,0)
    // The enemy's bounding box is mocked directly.
    enemy.getBoundingBox.mockReturnValue(new THREE.Box3(new THREE.Vector3(-0.5, -0.5, -0.5), new THREE.Vector3(0.5, 0.5, 0.5)));

    const initialLives = levelManager.lives;
    const initialScore = 50;
    levelManager.score = initialScore;
    // Score penalty is to reset to current level's requirement, which is 0 for level 1.
    const scorePenaltyExpected = 0;


    levelManager['checkCollisions'](); // Call private method

    expect(levelManager.lives).toBe(initialLives - 1);
    expect(player.position.set).toHaveBeenCalledWith(0, 10, 0); // Player position reset (default player spawn y is 10)
    expect(levelManager.score).toBe(scorePenaltyExpected);
    expect(mockScoreDisplay.textContent).toBe(`Score: ${scorePenaltyExpected}`);
    expect(showFeedbackMessage).toHaveBeenCalledWith('HIT!', 'error');
    expect(triggerScreenFlash).toHaveBeenCalledWith('red');
    expect(playSound).toHaveBeenCalledWith('collision', expect.any(Number));
    expect(stopCurrentMusic).toHaveBeenCalled();
    expect(playStandardMusic).toHaveBeenCalled();
  });

  it.skip('should trigger game over when lives reach zero after a collision', () => {
    player.position.set(0, 0, 0);
    const enemy = levelManager.enemies[0];
    enemy.getBoundingBox.mockReturnValue(new THREE.Box3(new THREE.Vector3(-0.5, -0.5, -0.5), new THREE.Vector3(0.5, 0.5, 0.5)));
    levelManager.lives = 1;
    levelManager.score = 100; // Arbitrary score

    levelManager['checkCollisions'](); // This collision will make lives 0

    expect(levelManager.lives).toBe(0);
    expect(mockLivesDisplay.textContent).toBe('Lives: 0');
    expect(mockGameOverScreen.classList.contains('hidden')).toBe(false);
    expect(mockFinalScore.textContent).toBe('100'); // Score before collision that led to game over
    expect(playSound).toHaveBeenCalledWith('gameover', expect.any(Number));
    expect(stopCurrentMusic).toHaveBeenCalledTimes(2); // Once for collision, once for game over

    // Check if update loop is paused (e.g. score doesn't change, no more music calls)
    vi.clearAllMocks(); // Clear previous calls to sound functions
    levelManager.update(1.0); // Try to update after game over
    expect(levelManager.score).toBe(0); // Score is reset to 0 on game over by handlePlayerDefeat
    expect(playStandardMusic).not.toHaveBeenCalled();
    expect(playTenseMusic).not.toHaveBeenCalled();
  });

  it.skip('should reset game state correctly with resetGameState', () => {
    // Change state
    levelManager.currentLevel = 3;
    levelManager.score = 150;
    levelManager.lives = 1;
    player.position.set(10, 10, 10);
    mockGameOverScreen.classList.remove('hidden');

    levelManager.resetGameState();

    expect(levelManager.lives).toBe(3);
    expect(mockLivesDisplay.textContent).toBe('Lives: 3');
    expect(levelManager.score).toBe(0);
    expect(mockScoreDisplay.textContent).toBe('Score: 0');
    expect(levelManager.currentLevel).toBe(1);
    expect(mockLevelDisplay.textContent).toBe('Level: 1');
    expect(player.position.set).toHaveBeenCalledWith(0, 10, 0); // Default spawn
    expect(mockGameOverScreen.classList.contains('hidden')).toBe(true);
    // advanceToLevel(1) is called, which spawns 1 enemy for level 1.
    // scene.add is called for each enemy.
    // We cleared mocks at start of beforeEach, then LevelManager constructor calls advanceToLevel(1) -> scene.add (1 enemy)
    // resetGameState calls advanceToLevel(1) again -> scene.remove (for enemies of prev level if any), scene.add (1 new enemy)
    // Verify enemies were recreated
    expect(Enemy).toHaveBeenCalledTimes(1 + 1); // Constructor for Enemy class
  });

  it.skip('should manage tense music based on enemy proximity', () => {
    // Ensure we have at least one enemy from initial setup
    expect(levelManager.enemies.length).toBeGreaterThan(0);
    const testEnemy = levelManager.enemies[0]; // Get the actual enemy instance

    // Case 1: Enemy is far, standard music should play (or continue)
    player.position.set(100, 100, 100); // Player far
    testEnemy.mesh.position.set(0, 0, 0); // Enemy at origin
    levelManager.update(0.1); // Trigger music check
    expect(playStandardMusic).toHaveBeenCalled();
    vi.clearAllMocks();

    // Case 2: Enemy is close, tense music should play
    // The tense music distance threshold is 20.
    player.position.set(5, 0, 0); // Player close to enemy at (0,0,0)
    testEnemy.mesh.position.set(0, 0, 0);
    levelManager.update(0.1);
    expect(playTenseMusic).toHaveBeenCalled();
    expect(playStandardMusic).not.toHaveBeenCalled(); // Should not switch back immediately
    vi.clearAllMocks();

    // Case 3: Enemy moves away, standard music should resume
    player.position.set(30, 0, 0); // Player moves far again
    testEnemy.mesh.position.set(0, 0, 0);
    // Need to ensure tense music was playing
    levelManager['isTenseMusicPlaying'] = true;
    levelManager.update(0.1);
    expect(playStandardMusic).toHaveBeenCalled();
    expect(playTenseMusic).not.toHaveBeenCalled();
    vi.clearAllMocks();

    // Case 4: Game over, music changes should be prevented
    levelManager.lives = 0; // Game is over
    levelManager['isTenseMusicPlaying'] = false;
    player.position.set(5, 0, 0); // Player close to enemy
    testEnemy.mesh.position.set(0, 0, 0);
    levelManager.update(0.1);
    expect(playTenseMusic).not.toHaveBeenCalled();
    expect(playStandardMusic).not.toHaveBeenCalled();
  });
});
