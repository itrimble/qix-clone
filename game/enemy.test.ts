import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';
import { Enemy, EnemyOptions } from './enemy';
import { player as mockedPlayer } from './engine'; // Import the mocked player
import * as Materials from './materials'; // To mock materials

// Mock THREE.js components
vi.mock('three', async (importOriginal) => {
  const actualThree = await importOriginal() as any;
  return {
    ...actualThree,
    BoxGeometry: vi.fn(),
    EdgesGeometry: vi.fn(),
    Mesh: vi.fn().mockImplementation(function (this: any, geometry: any, material: any) {
      this.geometry = geometry;
      this.material = material;
      this.position = new actualThree.Vector3(); // Initialize position
      this.add = vi.fn(); // Spyable add method
      this.children = []; // Mock children array for wireframe
      this.name = ''; // Default name
      return this;
    }),
    LineSegments: vi.fn().mockImplementation(function (this: any, geometry: any, material: any) {
        this.geometry = geometry;
        this.material = material;
        this.name = 'wireframe'; // Give it a name to identify if needed
        return this;
    }),
    Box3: vi.fn().mockImplementation(function (this: any) {
      this.min = new actualThree.Vector3();
      this.max = new actualThree.Vector3();
      this.setFromObject = vi.fn().mockImplementation((object: any) => {
        // A more realistic mock might try to use object's geometry if available
        if (object && object.geometry && object.geometry.boundingBox) {
            this.copy(object.geometry.boundingBox);
        } else {
            this.min.set(-1,-1,-1); // Default box
            this.max.set(1,1,1);
        }
        return this;
      });
      this.copy = vi.fn().mockImplementation((box: any) => {
        this.min.copy(box.min);
        this.max.copy(box.max);
        return this;
      });
      return this;
    }),
    Vector3: actualThree.Vector3, // Use actual Vector3
    Material: actualThree.Material, // Use actual Material as base for mocks
    MeshBasicMaterial: actualThree.MeshBasicMaterial, // For custom material test
  };
});

// Mock materials
const mockEnemyMaterialInstance = new THREE.Material();
mockEnemyMaterialInstance.name = "MockEnemyMat";
const mockEdgeMaterialInstance = new THREE.Material();
mockEdgeMaterialInstance.name = "MockEdgeMat";

vi.mock('./materials', () => ({
  enemyMaterial: mockEnemyMaterialInstance,
  edgeMaterial: mockEdgeMaterialInstance,
}));

// Mock player from engine
vi.mock('./engine', () => ({
  player: {
    position: new THREE.Vector3(0, 0, 0), // Default player position for tests
  },
}));

describe('Enemy (Base Class)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset player position for each test
    mockedPlayer.position.set(0, 0, 0);
  });

  it('constructor should initialize with default options', () => {
    const enemy = new Enemy();
    expect(THREE.Mesh).toHaveBeenCalled();
    const meshInstance = (THREE.Mesh as any).mock.results[0].value;
    expect(meshInstance.material).toBe(mockEnemyMaterialInstance);
    expect(meshInstance.add).toHaveBeenCalled();

    const lineSegmentsInstance = (THREE.LineSegments as any).mock.results[0].value;
    expect(THREE.LineSegments).toHaveBeenCalledWith(expect.any(THREE.EdgesGeometry), mockEdgeMaterialInstance);
    expect(meshInstance.add).toHaveBeenCalledWith(lineSegmentsInstance);

    expect(meshInstance.position.equals(new THREE.Vector3(5, 5, 0))).toBe(true);
    expect(enemy.speed).toBe(0.05);

    const box3Instance = (THREE.Box3 as any).mock.results[0].value;
    expect(box3Instance.setFromObject).toHaveBeenCalledWith(meshInstance);
    expect(enemy.getBoundingBox()).toBe(box3Instance);
  });

  it('constructor should initialize with custom options', () => {
    const customMaterial = new THREE.MeshBasicMaterial({color: 0xff0000});
    const options: EnemyOptions = {
      position: new THREE.Vector3(1, 2, 3),
      speed: 0.1,
      material: customMaterial,
      name: 'CustomEnemy'
    };
    const enemy = new Enemy(options);
    const meshInstance = (THREE.Mesh as any).mock.results[0].value;

    expect(meshInstance.material).toBe(customMaterial);
    expect(meshInstance.position.equals(new THREE.Vector3(1, 2, 3))).toBe(true);
    expect(enemy.speed).toBe(0.1);
    expect(meshInstance.name).toBe('CustomEnemy');
  });

  it('update should update the bounding box', () => {
    const enemy = new Enemy();
    const boundingBoxMockInstance = enemy.getBoundingBox(); // Get the mocked Box3 instance from constructor

    // Clear mock calls from constructor
    vi.clearAllMocks(); // This clears calls on ALL mocks. Be careful if other mocks are prepared before.
                        // Or specifically: (boundingBoxMockInstance.setFromObject as any).mockClear();

    enemy.update();
    // We need to ensure setFromObject on the specific boundingBox instance of *this* enemy is called.
    // The way Enemy is written, this.boundingBox is the instance.
    expect(boundingBoxMockInstance.setFromObject).toHaveBeenCalledWith(enemy.mesh);
  });

  it('getBoundingBox should return the bounding box', () => {
    const enemy = new Enemy();
    const boxInstanceFromConstructor = (THREE.Box3 as any).mock.results[0].value;
    // Constructor already calls setFromObject once on the Box3 instance created for this enemy.

    const returnedBox = enemy.getBoundingBox();
    expect(returnedBox).toBe(boxInstanceFromConstructor); // Should be the same instance
    expect(boxInstanceFromConstructor.setFromObject).toHaveBeenCalledTimes(1); // Called once by constructor

    enemy.update(); // This will call setFromObject again on the same instance
    expect(boxInstanceFromConstructor.setFromObject).toHaveBeenCalledTimes(2);
  });

  it('chasePlayer should move enemy towards player', () => {
    mockedPlayer.position.set(10, 0, 0);
    const enemy = new Enemy({ position: new THREE.Vector3(0, 0, 0), speed: 0.1 });

    enemy.chasePlayer();

    // Expected movement: direction (1,0,0) * speed 0.1 = (0.1, 0, 0)
    // New position: (0,0,0) + (0.1,0,0) = (0.1,0,0)
    expect(enemy.mesh.position.x).toBeCloseTo(0.1);
    expect(enemy.mesh.position.y).toBeCloseTo(0);
    expect(enemy.mesh.position.z).toBeCloseTo(0);
  });

  it('chasePlayer should not move if player is at same position', () => {
    mockedPlayer.position.set(5, 5, 0); // Player is at the same position as enemy
    const enemy = new Enemy({ position: new THREE.Vector3(5, 5, 0), speed: 0.1 });
    const initialPosition = enemy.mesh.position.clone();

    enemy.chasePlayer(); // Should not result in NaN or error due to zero vector for direction

    expect(enemy.mesh.position.equals(initialPosition)).toBe(true);
  });
});
