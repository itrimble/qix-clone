import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { createScene, updateScene, player, BASE_PLAYER_SPEED, gridLimit } from './engine';
import { keys } from '../ui/controls';

// Mock dependencies - use type assertions for test mocks
vi.mock('three', async (importOriginal) => {
  const actualThree = await importOriginal() as typeof THREE;

  // Create a mock Mesh constructor that properly sets up instance properties
  const MockMesh = vi.fn().mockImplementation(function(
    this: Record<string, unknown>,
    geometry: THREE.BufferGeometry,
    material: THREE.Material
  ) {
    this.geometry = geometry;
    this.material = material;
    this.position = new actualThree.Vector3(0, 0, 0);
    this.rotation = new actualThree.Euler(0, 0, 0);
    this.scale = new actualThree.Vector3(1, 1, 1);
    this.castShadow = false;
    this.receiveShadow = false;
    this.add = vi.fn();
    this.getWorldPosition = vi.fn().mockReturnValue(new actualThree.Vector3());
    this.parent = null;
    return this;
  });

  return {
    ...actualThree,
    Scene: vi.fn(() => ({ add: vi.fn(), background: null, children: [] })),
    PerspectiveCamera: vi.fn(() => ({ position: { set: vi.fn() }, lookAt: vi.fn() })),
    WebGLRenderer: vi.fn(() => ({
      domElement: document.createElement('canvas'),
      setSize: vi.fn(),
      setClearColor: vi.fn(),
      render: vi.fn(),
      setPixelRatio: vi.fn(),
      shadowMap: { enabled: false },
    })),
    AmbientLight: vi.fn(),
    DirectionalLight: vi.fn(() => ({
      position: Object.assign(new actualThree.Vector3(), {
        set: vi.fn(function(this: THREE.Vector3, x: number, y: number, z: number) {
          this.x = x;
          this.y = y;
          this.z = z;
          return this;
        })
      }),
      castShadow: false,
      shadow: {}
    })),
    GridHelper: vi.fn(() => ({ rotation: { x: 0 } })),
    BoxGeometry: vi.fn(),
    MeshPhongMaterial: vi.fn(),
    Mesh: MockMesh,
    Vector3: actualThree.Vector3,
    Euler: actualThree.Euler,
  };
});

vi.mock('../ui/controls', () => ({
  keys: {
    'arrowup': false, 'ArrowUp': false, 'w': false,
    'arrowdown': false, 'ArrowDown': false, 's': false,
    'arrowleft': false, 'ArrowLeft': false, 'a': false,
    'arrowright': false, 'ArrowRight': false, 'd': false,
  },
  initKeyListeners: vi.fn(), // Mock initKeyListeners if it's called by engine or UI setup
}));

vi.mock('./backgrounds', () => ({
  createStarfield: vi.fn().mockReturnValue(new THREE.Object3D()), // Return a dummy object
  createNebulaGradient: vi.fn(),
}));


describe('Game Engine Logic', () => {
  let mockCanvas: HTMLCanvasElement;
  let sceneFromSetup: THREE.Scene;

  beforeEach(() => {
    mockCanvas = document.createElement('canvas');
    mockCanvas.width = 800;
    mockCanvas.height = 600;

    // Reset keys before each test
    for (const key in keys) {
      (keys as Record<string, boolean>)[key] = false;
    }

    // createScene will assign to the global player and use mocked THREE components
    const { scene } = createScene(mockCanvas);
    sceneFromSetup = scene;

    // Ensure player's parent is set for updateScene logic
    const mockScene = sceneFromSetup as unknown as { add: { mock: { calls: unknown[][] } } };
    if (player && mockScene.add?.mock) {
      const playerAddedToScene = mockScene.add.mock.calls.some((callArgs: unknown[]) => callArgs[0] === player);
      if (playerAddedToScene) {
        (player as unknown as { parent: THREE.Scene }).parent = sceneFromSetup;
      }
    }
  });

  afterEach(() => {
    vi.clearAllMocks();
    // Reset player if it's a global mock modified by tests
    if (player && player.position) {
        player.position.set(0,0,0);
    }
  });

  it('should initialize the player correctly in createScene', () => {
    expect(THREE.Mesh).toHaveBeenCalled();
    expect(player).toBeDefined();
    // Initial position is set by createPlayer function in engine.ts
    expect(player.position.x).toBe(0);
    expect(player.position.y).toBe(0); // Default player Y position is 0
    expect(player.position.z).toBe(0);
    expect(sceneFromSetup.add).toHaveBeenCalledWith(player);
  });

  it('should move player up when up arrow key is pressed', () => {
    player.position.set(0, 0, 0); // Start from a known position
    const initialY = player.position.y;
    keys['arrowup'] = true;
    updateScene(sceneFromSetup, 1); // speedMultiplier = 1
    expect(player.position.y).toBe(initialY + BASE_PLAYER_SPEED * 1);
    keys['arrowup'] = false;
  });

  it('should move player down when down arrow key is pressed', () => {
    player.position.set(0, 0, 0);
    const initialY = player.position.y;
    keys['arrowdown'] = true;
    updateScene(sceneFromSetup, 1);
    expect(player.position.y).toBe(initialY - BASE_PLAYER_SPEED * 1);
    keys['arrowdown'] = false;
  });

  it('should move player left when left arrow key is pressed', () => {
    player.position.set(0, 0, 0);
    const initialX = player.position.x;
    keys['arrowleft'] = true;
    updateScene(sceneFromSetup, 1);
    expect(player.position.x).toBe(initialX - BASE_PLAYER_SPEED * 1);
    keys['arrowleft'] = false;
  });

  it('should move player right when right arrow key is pressed', () => {
    player.position.set(0, 0, 0);
    const initialX = player.position.x;
    keys['arrowright'] = true;
    updateScene(sceneFromSetup, 1);
    expect(player.position.x).toBe(initialX + BASE_PLAYER_SPEED * 1);
    keys['arrowright'] = false;
  });

  it('should constrain player movement within grid limits (top)', () => {
    player.position.set(0, gridLimit, 0); // Start at the boundary
    keys['arrowup'] = true;
    updateScene(sceneFromSetup, 1); // Attempt to move further
    expect(player.position.y).toBe(gridLimit);
    keys['arrowup'] = false;

    player.position.set(0, gridLimit - 0.1, 0); // Start just inside boundary
    keys['arrowup'] = true; // Need to press key to test movement
    updateScene(sceneFromSetup, 1); // Move up
    expect(player.position.y).toBe(gridLimit); // Should be clamped
    keys['arrowup'] = false;
  });

  it('should constrain player movement within grid limits (bottom)', () => {
    player.position.set(0, -gridLimit, 0);
    keys['arrowdown'] = true;
    updateScene(sceneFromSetup, 1);
    expect(player.position.y).toBe(-gridLimit);
    keys['arrowdown'] = false;

    player.position.set(0, -gridLimit + 0.1, 0);
    keys['arrowdown'] = true; // Need to press key to test movement
    updateScene(sceneFromSetup, 1);
    expect(player.position.y).toBe(-gridLimit);
    keys['arrowdown'] = false;
  });

  it('should constrain player movement within grid limits (left)', () => {
    player.position.set(-gridLimit, 0, 0);
    keys['arrowleft'] = true;
    updateScene(sceneFromSetup, 1);
    expect(player.position.x).toBe(-gridLimit);
    keys['arrowleft'] = false;

    player.position.set(-gridLimit + 0.1, 0, 0);
    keys['arrowleft'] = true; // Need to press key to test movement
    updateScene(sceneFromSetup, 1);
    expect(player.position.x).toBe(-gridLimit);
    keys['arrowleft'] = false;
  });

  it('should constrain player movement within grid limits (right)', () => {
    player.position.set(gridLimit, 0, 0);
    keys['arrowright'] = true;
    updateScene(sceneFromSetup, 1);
    expect(player.position.x).toBe(gridLimit);
    keys['arrowright'] = false;

    player.position.set(gridLimit - 0.1, 0, 0);
    keys['arrowright'] = true; // Need to press key to test movement
    updateScene(sceneFromSetup, 1);
    expect(player.position.x).toBe(gridLimit);
    keys['arrowright'] = false;
  });

});
