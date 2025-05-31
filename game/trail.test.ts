import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { initTrail, updateTrail, clearTrail, getTrailPoints, MAX_TRAIL_POINTS } from './trail';
import * as Materials from './materials'; // To mock createTrailMaterial

// Mock THREE.js components used by trail.ts
// Keep essential mocks, ensure BufferAttribute.array can be spied on or checked
vi.mock('three', async (importOriginal) => {
  const actualThree = await importOriginal() as any;
  return {
    ...actualThree,
    Line: vi.fn().mockImplementation(function (this: any, geometry: any, material: any) {
      this.geometry = geometry;
      this.material = material;
      this.frustumCulled = false;
      this.dispose = vi.fn();
      this.parent = { remove: vi.fn() }; // Mock parent for removal
      return this;
    }),
    BufferGeometry: vi.fn().mockImplementation(function (this: any) {
      this.setAttribute = vi.fn();
      this.dispose = vi.fn();
      this.getAttribute = vi.fn().mockImplementation((name: string) => {
        if (name === 'position' && this.attributes && this.attributes.position) {
          return this.attributes.position;
        }
        return undefined;
      });
      this.setDrawRange = vi.fn();
      this.attributes = { position: undefined }; // To store the attribute later
      return this;
    }),
    BufferAttribute: actualThree.BufferAttribute, // Use actual for spy target
    Float32BufferAttribute: actualThree.Float32BufferAttribute, // Use actual for spy target
    Vector3: actualThree.Vector3,
    LineBasicMaterial: actualThree.LineBasicMaterial, // For material mock
  };
});

// Mock material creation
vi.mock('./materials', () => {
  // Define and initialize the mock instance *inside* the factory to avoid hoisting issues.
  const mockTrailMaterialInFactory = new THREE.LineBasicMaterial({ color: 0xff0000 });
  return {
    createTrailMaterial: vi.fn().mockReturnValue(mockTrailMaterialInFactory),
  };
});

describe('Trail Logic (Optimized)', () => {
  let sceneMock: any;
  let mockPositionAttribute: THREE.BufferAttribute;
  let mockPositionsArray: Float32Array;

  beforeEach(() => {
    sceneMock = {
        add: vi.fn(),
        remove: vi.fn(),
    } as any;

    // For the optimized version, the BufferAttribute and its array are created once.
    // We need to mock/spy on this array to check updates.
    // This setup assumes initTrail will use a BufferAttribute with an underlying Float32Array.
    mockPositionsArray = new Float32Array(MAX_TRAIL_POINTS * 3);
    mockPositionAttribute = new THREE.BufferAttribute(mockPositionsArray, 3);

    // When THREE.BufferGeometry is constructed by initTrail, and setAttribute is called,
    // we can intercept it to store our mockPositionAttribute.
    (THREE.BufferGeometry as any).mockImplementation(function (this: any) {
        this.setAttribute = vi.fn((name: string, attribute: THREE.BufferAttribute) => {
            if (name === 'position') {
                // Instead of using the attribute passed (which would be a new one each time in unmocked code),
                // assign our pre-defined spyable attribute here.
                this.attributes = { position: mockPositionAttribute };
            }
        });
        this.dispose = vi.fn();
        this.getAttribute = vi.fn().mockImplementation((name: string) => {
            if (name === 'position') return this.attributes.position;
            return undefined;
        });
        this.setDrawRange = vi.fn();
        this.attributes = { position: undefined }; // Ensure it's there
        return this;
    });

    // Reset internal state of trail.ts by calling its functions
    // clearTrail might be called by initTrail or other places, ensure it's clean first.
    // The actual clearTrail will operate on the module-scoped trailLine.
    clearTrail(sceneMock); // Clears trailPoints, currentTrailLength and drawRange on existing trailLine
    vi.clearAllMocks(); // Clear mocks after potential calls in clearTrail

    // Re-initialize sceneMock spies if clearAllMocks affected them (it does)
     sceneMock.add = vi.fn();
     sceneMock.remove = vi.fn();

    // Call initTrail here to set up trailLine with the mocked BufferGeometry/Attribute
    initTrail(sceneMock);
  });


  it('initTrail should initialize with a pre-allocated buffer and drawRange 0', () => {
    expect(Materials.createTrailMaterial).toHaveBeenCalled(); // This will now correctly point to the mocked version
    expect(THREE.BufferGeometry).toHaveBeenCalled();

    const lineInstance = (THREE.Line as any).mock.results[0].value;
    expect(sceneMock.add).toHaveBeenCalledWith(lineInstance);

    const geometryInstance = lineInstance.geometry;
    expect(geometryInstance.setAttribute).toHaveBeenCalledWith('position', expect.any(THREE.BufferAttribute));
    const posAttribute = geometryInstance.getAttribute('position') as THREE.BufferAttribute;
    expect(posAttribute.array.length).toBe(MAX_TRAIL_POINTS * 3);

    expect(geometryInstance.setDrawRange).toHaveBeenCalledWith(0, 0);
    expect(getTrailPoints()).toEqual([]);
  });

  it('updateTrail should add a point to buffer, update needsUpdate and drawRange', () => {
    const point1 = new THREE.Vector3(1, 2, 3);
    updateTrail(sceneMock, point1);

    expect(mockPositionsArray[0]).toBe(point1.x);
    expect(mockPositionsArray[1]).toBe(point1.y);
    expect(mockPositionsArray[2]).toBe(point1.z);

    const lineInstance = (THREE.Line as any).mock.results[0].value;
    const geometryInstance = lineInstance.geometry;
    const posAttribute = geometryInstance.getAttribute('position') as THREE.BufferAttribute;

    expect(posAttribute.needsUpdate).toBe(true);
    expect(geometryInstance.setDrawRange).toHaveBeenCalledWith(0, 1); // 1 point added

    const trailPoints = getTrailPoints();
    expect(trailPoints.length).toBe(1);
    expect(trailPoints[0].equals(point1)).toBe(true);
  });

  it('updateTrail should handle buffer when not full', () => {
    for (let i = 0; i < 10; i++) {
      updateTrail(sceneMock, new THREE.Vector3(i, i, i));
    }
    const lineInstance = (THREE.Line as any).mock.results[0].value;
    expect(lineInstance.geometry.setDrawRange).toHaveBeenCalledWith(0, 10);
    expect(getTrailPoints().length).toBe(10);
    expect(mockPositionsArray[9 * 3]).toBe(9); // Check last added point
  });

  it('updateTrail should handle buffer when full and overwrite oldest points', () => {
    // Fill the buffer
    for (let i = 0; i < MAX_TRAIL_POINTS; i++) {
      updateTrail(sceneMock, new THREE.Vector3(i, i, i));
    }
    expect(getTrailPoints().length).toBe(MAX_TRAIL_POINTS);
    expect(mockPositionsArray[(MAX_TRAIL_POINTS - 1) * 3]).toBe(MAX_TRAIL_POINTS - 1);

    // Add one more point, which should overwrite the oldest
    const newPoint = new THREE.Vector3(MAX_TRAIL_POINTS, MAX_TRAIL_POINTS, MAX_TRAIL_POINTS);
    updateTrail(sceneMock, newPoint);

    expect(getTrailPoints().length).toBe(MAX_TRAIL_POINTS);
    // The internal trailPoints array has shifted, and the buffer is rewritten.
    // The first point in the buffer should now be original point 1 (value 1)
    expect(mockPositionsArray[0]).toBe(1);
    // The last point in the buffer should be newPoint
    expect(mockPositionsArray[(MAX_TRAIL_POINTS - 1) * 3]).toBe(newPoint.x);

    const lineInstance = (THREE.Line as any).mock.results[0].value;
    expect(lineInstance.geometry.setDrawRange).toHaveBeenCalledWith(0, MAX_TRAIL_POINTS);
  });

  it('clearTrail should reset drawRange to 0 and clear internal points array', () => {
    updateTrail(sceneMock, new THREE.Vector3(1,1,1)); // Add a point

    clearTrail(sceneMock);

    const lineInstance = (THREE.Line as any).mock.results[0].value; // line should still exist
    expect(lineInstance.geometry.setDrawRange).toHaveBeenCalledWith(0, 0);
    expect(getTrailPoints()).toEqual([]);
  });

  it('getTrailPoints should return a deep copy of currently active trail points', () => {
    initTrail(sceneMock); // Re-init to be sure about trailLine instance for this test
    const point1 = new THREE.Vector3(1,2,3);
    updateTrail(sceneMock, point1);
    const point2 = new THREE.Vector3(4,5,6);
    updateTrail(sceneMock, point2);

    const retrievedPoints = getTrailPoints();
    expect(retrievedPoints.length).toBe(2);
    expect(retrievedPoints).toEqual([point1, point2]);
    expect(retrievedPoints[0]).not.toBe(point1); // Ensure it's a clone
    expect(retrievedPoints[1]).not.toBe(point2);
  });
});
