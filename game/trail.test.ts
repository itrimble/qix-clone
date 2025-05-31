import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';
import { initTrail, updateTrail, clearTrail, getTrailPoints, MAX_TRAIL_POINTS } from './trail';
import * as Materials from './materials'; // To mock createTrailMaterial

// Mock THREE.js components used by trail.ts
vi.mock('three', async (importOriginal) => {
  const actualThree = await importOriginal() as any;
  return {
    ...actualThree,
    Line: vi.fn().mockImplementation(function (geometry, material) {
      this.geometry = geometry; // geometry should be an instance of the mocked BufferGeometry
      this.material = material;
      this.frustumCulled = false; // a property often set
      this.dispose = vi.fn();
      return this;
    }),
    BufferGeometry: vi.fn().mockImplementation(function () {
      this.setAttribute = vi.fn();
      this.dispose = vi.fn();
      this.getAttribute = vi.fn().mockReturnValue(undefined); // Start with no attributes
      this.setDrawRange = vi.fn(); // setDrawRange is used in trail.ts
      return this;
    }),
    Vector3: actualThree.Vector3,
    Float32BufferAttribute: actualThree.Float32BufferAttribute,
  };
});

// Mock material creation
vi.mock('./materials', () => ({
  createTrailMaterial: vi.fn().mockReturnValue(new THREE.LineBasicMaterial({ color: 0xff0000 })),
}));

describe('Trail Logic', () => {
  let sceneMock: any; // Use 'any' for mocked THREE.Scene

  beforeEach(() => {
    // Create a new Scene mock for each test to ensure fresh spies
    sceneMock = {
        add: vi.fn(),
        remove: vi.fn(),
        // Add any other scene properties/methods used by trail.ts if necessary
    } as any; // Cast to any to satisfy THREE.Scene type while using a simple object

    // Reset internal state of trail.ts by clearing points and line.
    // This is crucial because trailPoints and trailLine are module-scoped.
    clearTrail(sceneMock); // Call the actual clearTrail to reset module state
    vi.clearAllMocks(); // Clear mock call counts AFTER resetting state

    // Re-mock scene methods for the current test since clearAllMocks clears them
    // if they were part of a global mock. If sceneMock is locally created like above,
    // its spies are fresh per test anyway.
    // For safety, if sceneMock was from a global vi.mock('three', ...), re-spy here:
    // vi.spyOn(sceneMock, 'add');
    // vi.spyOn(sceneMock, 'remove');
  });

  it('initTrail should initialize the trail system', () => {
    initTrail(sceneMock);

    expect(Materials.createTrailMaterial).toHaveBeenCalled();
    // BufferGeometry is newed up inside initTrail, then a line is created with it.
    expect(THREE.BufferGeometry).toHaveBeenCalled();
    expect(THREE.Line).toHaveBeenCalled();
    const lineInstance = (THREE.Line as any).mock.results[0].value;
    expect(sceneMock.add).toHaveBeenCalledWith(lineInstance);
    expect(getTrailPoints()).toEqual([]);
  });

  it('updateTrail should add a point and update the line geometry', () => {
    initTrail(sceneMock);
    const point1 = new THREE.Vector3(1, 2, 3);

    // Before updateTrail, BufferGeometry's setAttribute should not have been called with actual points
    const lineInstance = (THREE.Line as any).mock.results[0].value;
    expect(lineInstance.geometry.setAttribute).not.toHaveBeenCalledWith('position', expect.any(THREE.Float32BufferAttribute));

    updateTrail(sceneMock, point1);

    const trailPoints = getTrailPoints();
    expect(trailPoints.length).toBe(1);
    expect(trailPoints[0]).toEqual(point1);

    // Check that the geometry was updated
    expect(lineInstance.geometry.setAttribute).toHaveBeenCalledWith('position', expect.any(THREE.Float32BufferAttribute));
    // Check if the buffer attribute has the correct values (1 point * 3 coordinates)
    const bufferAttributeArgs = (lineInstance.geometry.setAttribute as any).mock.calls[0][1];
    expect(bufferAttributeArgs.array.length).toBe(MAX_TRAIL_POINTS * 3); // Buffer is full size
    expect(bufferAttributeArgs.array[0]).toBe(1);
    expect(bufferAttributeArgs.array[1]).toBe(2);
    expect(bufferAttributeArgs.array[2]).toBe(3);
    expect(lineInstance.geometry.setDrawRange).toHaveBeenCalledWith(0, 1);
  });

  it('updateTrail should limit trail length to MAX_TRAIL_POINTS (500)', () => {
    initTrail(sceneMock);
    for (let i = 0; i < MAX_TRAIL_POINTS + 10; i++) { // Add 510 points
      updateTrail(sceneMock, new THREE.Vector3(i, i, i));
    }
    const trailPoints = getTrailPoints();
    expect(trailPoints.length).toBe(MAX_TRAIL_POINTS);
    // Oldest point should be (10,10,10) after 510 additions (points 0-9 are removed)
    expect(trailPoints[0].x).toBe(10);
    expect(trailPoints[0].y).toBe(10);
    expect(trailPoints[0].z).toBe(10);
    // Newest point
    expect(trailPoints[MAX_TRAIL_POINTS-1].x).toBe(MAX_TRAIL_POINTS + 9);
  });

  it('clearTrail should remove the trail and reset points', () => {
    initTrail(sceneMock); // This creates a line and geometry
    updateTrail(sceneMock, new THREE.Vector3(1,1,1));

    const lineInstance = (THREE.Line as any).mock.results[0].value;
    // Spy on the dispose method of the specific geometry instance created by initTrail
    const geometryDisposeSpy = vi.spyOn(lineInstance.geometry, 'dispose');

    clearTrail(sceneMock);

    expect(sceneMock.remove).toHaveBeenCalledWith(lineInstance);
    expect(geometryDisposeSpy).toHaveBeenCalled();
    expect(getTrailPoints()).toEqual([]);

    // Check if trailLine (internal variable) is null.
    // One way: initTrail again should create a new line if trailLine was reset.
    const firstLineInstance = lineInstance;
    initTrail(sceneMock); // Should create a new line. This is the 2nd Line mock instance.
    // The mock stores results in order. Since clearAllMocks was called in beforeEach,
    // initTrail in this test is the first call to THREE.Line constructor for this test's mock set.
    // However, clearTrail itself might call initTrail if it's designed to reset to an empty trail line.
    // Current trail.ts clearTrail does not call initTrail. It nulls trailLine.
    // So, the next initTrail call will be the second overall in this test's lifecycle (first one at the top of test).

    // If beforeEach's clearTrail calls sceneMock.remove, then vi.clearAllMocks() will clear that call.
    // The calls to initTrail are:
    // 1. In this test: initTrail(sceneMock); -> first Line instance
    // 2. After clearTrail: initTrail(sceneMock); -> second Line instance
    // So we expect mock.results[1] for the second instance.
    const newLineInstance = (THREE.Line as any).mock.results[1].value;
    expect(newLineInstance).not.toBe(firstLineInstance);
  });

  it('getTrailPoints should return a deep copy of trail points', () => {
    initTrail(sceneMock);
    const point1 = new THREE.Vector3(1,2,3);
    updateTrail(sceneMock, point1);

    const retrievedPoints = getTrailPoints();
    expect(retrievedPoints).toEqual([point1]); // Checks for value equality
    expect(retrievedPoints[0]).toBeInstanceOf(THREE.Vector3);
    expect(retrievedPoints[0]).not.toBe(point1); // Ensure it's a clone, not the same instance
  });
});
