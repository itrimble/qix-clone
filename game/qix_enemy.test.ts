import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { QixEnemy, QIX_COLOR, QIX_SPEED, NUM_SEGMENTS } from './qix_enemy';

const testInitialPos = new THREE.Vector2(0, 0);
const testConfinement = { minX: -10, maxX: 10, minY: -10, maxY: 10 };

describe('QixEnemy', () => {
  let qix: QixEnemy;
  let mockMathRandom: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Mock Math.random for predictable velocities
    let randomCounter = 0;
    const randomValues = [0.6, 0.8, 0.5, 0.7, 0.3, 0.9]; // Enough for a few velocity randomizations
    mockMathRandom = vi.spyOn(Math, 'random').mockImplementation(() => {
      const val = randomValues[randomCounter % randomValues.length];
      randomCounter++;
      return val;
    });

    qix = new QixEnemy(testInitialPos.clone(), { ...testConfinement });
    vi.clearAllMocks(); // Clear mocks for fresh test, Math.random needs re-mocking if used again in a test
    randomCounter = 0; // Reset counter for Math.random spy
     mockMathRandom = vi.spyOn(Math, 'random').mockImplementation(() => {
      const val = randomValues[randomCounter % randomValues.length];
      randomCounter++;
      return val;
    });

  });

  afterEach(() => {
    mockMathRandom.mockRestore();
  });

  describe('Constructor', () => {
    it('should initialize correctly', () => {
      expect(qix.mesh).toBeInstanceOf(THREE.Line);
      expect((qix.mesh.material as THREE.LineBasicMaterial).color.getHex()).toBe(QIX_COLOR);
      expect(qix.position.equals(testInitialPos)).toBe(true);
      expect(qix.confinement).toEqual(testConfinement);

      // Check velocity magnitude (based on mocked Math.random: 0.6, 0.8)
      // vx = (0.6 - 0.5) * 2 * QIX_SPEED = 0.1 * 2 * 0.1 = 0.02
      // vy = (0.8 - 0.5) * 2 * QIX_SPEED = 0.3 * 2 * 0.1 = 0.06
      // magnitude = sqrt(0.02^2 + 0.06^2) = sqrt(0.0004 + 0.0036) = sqrt(0.004) approx 0.0632
      // This check is tricky due to normalization. Better to check individual components if random is stable.
      // The constructor normalizes and then multiplies by QIX_SPEED.
      // So, magnitude should be QIX_SPEED.
      expect(qix.velocity.length()).toBeCloseTo(QIX_SPEED);
      expect(qix.points.length).toBe(NUM_SEGMENTS + 1); // NUM_SEGMENTS lines means NUM_SEGMENTS+1 points

      // Check if updateLineGeometry was called (indirectly via geometry.setFromPoints)
      // The BufferGeometry is created inside QixEnemy, so we can't directly spy on its methods before construction.
      // Instead, we can check if the geometry has some data.
      expect(qix.mesh.geometry.attributes.position).toBeDefined();
      const positionAttribute = qix.mesh.geometry.attributes.position as THREE.BufferAttribute;
      expect(positionAttribute.count).toBe(NUM_SEGMENTS + 1);
    });
  });

  describe('updateLineGeometry', () => {
    it('should update mesh geometry points based on position, points, and time', () => {
      const originalPositions = (qix.mesh.geometry.attributes.position as THREE.BufferAttribute).array.slice();
      qix.time = Math.PI / 2; // Makes sin(time) = 1, cos(time) = 0 for predictable animation offsets
      qix['updateLineGeometry'](); // Access private method for test

      const newPositions = (qix.mesh.geometry.attributes.position as THREE.BufferAttribute).array;
      expect(newPositions).not.toEqual(originalPositions);

      // Check first point (head, qix.position)
      expect(newPositions[0]).toBeCloseTo(qix.position.x);
      expect(newPositions[1]).toBeCloseTo(qix.position.y);

      // Check one animated body point (e.g., the second point, index 1 in this.points)
      // this.points[0] is the first segment end.
      // For point p = this.points[0]:
      // animatedX = qix.position.x + p.x + Math.sin(qix.time * 2 + 1) * amplitude (where p.x is offset from head)
      // Here we can't easily predict p.x without knowing the initial velocity that formed the points.
      // A simpler check is that it's called and data changes. More specific checks are complex.
    });
  });

  describe('update', () => {
    const deltaTime = 0.1;

    it('should update time, position, and call updateLineGeometry', () => {
      const initialTime = qix.time;
      const initialPosition = qix.position.clone();
      const geometrySpy = vi.spyOn(qix.mesh.geometry, 'setFromPoints');

      qix.update(deltaTime, []);

      expect(qix.time).toBe(initialTime + deltaTime);
      expect(qix.position.x).toBeCloseTo(initialPosition.x + qix.velocity.x * deltaTime);
      expect(qix.position.y).toBeCloseTo(initialPosition.y + qix.velocity.y * deltaTime);
      expect(geometrySpy).toHaveBeenCalled();
    });

    // Wall bouncing
    it('should bounce off top wall', () => {
      qix.position.set(0, testConfinement.maxY - 0.01);
      qix.velocity.set(0, QIX_SPEED); // Moving up
      qix.update(deltaTime, []);
      expect(qix.position.y).toBeCloseTo(testConfinement.maxY);
      expect(qix.velocity.y).toBeCloseTo(-QIX_SPEED);
    });
    it('should bounce off bottom wall', () => {
      qix.position.set(0, testConfinement.minY + 0.01);
      qix.velocity.set(0, -QIX_SPEED); // Moving down
      qix.update(deltaTime, []);
      expect(qix.position.y).toBeCloseTo(testConfinement.minY);
      expect(qix.velocity.y).toBeCloseTo(QIX_SPEED);
    });
     it('should bounce off right wall', () => {
      qix.position.set(testConfinement.maxX - 0.01, 0);
      qix.velocity.set(QIX_SPEED, 0); // Moving right
      qix.update(deltaTime, []);
      expect(qix.position.x).toBeCloseTo(testConfinement.maxX);
      expect(qix.velocity.x).toBeCloseTo(-QIX_SPEED);
    });
    it('should bounce off left wall', () => {
      qix.position.set(testConfinement.minX + 0.01, 0);
      qix.velocity.set(-QIX_SPEED, 0); // Moving left
      qix.update(deltaTime, []);
      expect(qix.position.x).toBeCloseTo(testConfinement.minX);
      expect(qix.velocity.x).toBeCloseTo(QIX_SPEED);
    });

    it('should bounce off captured area', () => {
      const capturedShape = new THREE.Shape(); // Dummy shape
      vi.spyOn(capturedShape, 'containsPoint').mockReturnValue(true); // Qix will be "inside"

      qix.position.set(0,0); // Start at a point that will be 'contained'
      const originalVelocity = qix.velocity.clone();
      qix.update(deltaTime, [capturedShape]);

      // Position should revert (approximately, due to one step then correction)
      // or be pushed out. Current code reverts to pre-update position.
      expect(qix.position.x).toBeCloseTo(0 - originalVelocity.x * deltaTime);
      expect(qix.position.y).toBeCloseTo(0 - originalVelocity.y * deltaTime);

      // Velocity should be inverted (or significantly changed)
      // The current bounce logic inverts both components.
      expect(qix.velocity.x).toBeCloseTo(-originalVelocity.x);
      expect(qix.velocity.y).toBeCloseTo(-originalVelocity.y);
    });

    it('should not update properties when frozen', () => {
      qix.isFrozen = true;
      const initialTime = qix.time;
      const initialPosition = qix.position.clone();
      const geometrySpy = vi.spyOn(qix.mesh.geometry, 'setFromPoints');

      qix.update(deltaTime, []);

      expect(qix.time).toBe(initialTime);
      expect(qix.position.equals(initialPosition)).toBe(true);
      expect(geometrySpy).not.toHaveBeenCalled();
    });
  });

  describe('getLineSegments', () => {
    it('should return correct number of line segments', () => {
      const segments = qix.getLineSegments();
      expect(segments.length).toBe(NUM_SEGMENTS);
    });

    it('segments should reflect qix body points', () => {
      qix.time = 0; // Simplify animation for check
      qix['updateLineGeometry'](); // Update geometry with time = 0
      const segments = qix.getLineSegments();
      const positions = (qix.mesh.geometry.attributes.position as THREE.BufferAttribute).array;

      // Check first segment
      expect(segments[0].p1.x).toBeCloseTo(positions[0]);
      expect(segments[0].p1.y).toBeCloseTo(positions[1]);
      expect(segments[0].p2.x).toBeCloseTo(positions[3]); // Point 1 of geometry (index 1*3)
      expect(segments[0].p2.y).toBeCloseTo(positions[4]);
    });
  });

  describe('reset', () => {
    it('should reset Qix state', () => {
      qix.position.set(5,5);
      qix.velocity.set(0.5,0.5);
      qix.time = 10;
      qix.isFrozen = true;

      const newPos = new THREE.Vector2(1,1);
      const newConf = {minX:-5, maxX:5, minY:-5, maxY:5};
      const oldVelocityMagnitude = qix.velocity.length(); // Should be QIX_SPEED but capture for comparison

      // Reset Math.random spy for new velocity in reset
      let randomCounter = 0;
      const randomValues = [0.1, 0.2, 0.3, 0.4]; // New set for reset's randomization
      mockMathRandom.mockImplementation(() => {
        const val = randomValues[randomCounter % randomValues.length];
        randomCounter++;
        return val;
      });

      qix.reset(newPos, newConf);

      expect(qix.position.equals(newPos)).toBe(true);
      expect(qix.confinement).toEqual(newConf);
      expect(qix.isFrozen).toBe(false);
      expect(qix.time).toBe(0);
      expect(qix.velocity.length()).toBeCloseTo(QIX_SPEED);
      // Check if velocity actually changed from the specific 0.5,0.5 (it should due to re-randomization)
      expect(qix.velocity.x).not.toBe(0.5);
      expect(qix.mesh.geometry.attributes.position).toBeDefined(); // Implies updateLineGeometry called
    });
  });

  describe('setConfinement', () => {
    it('should update confinement and clamp position if needed', () => {
      const newConf = {minX: -5, maxX: 5, minY: -5, maxY: 5};
      qix.position.set(20, 20); // Position outside new confinement

      qix.setConfinement(newConf);

      expect(qix.confinement).toEqual(newConf);
      expect(qix.position.x).toBe(newConf.maxX); // Clamped
      expect(qix.position.y).toBe(newConf.maxY); // Clamped
      expect(qix.mesh.geometry.attributes.position).toBeDefined(); // Implies updateLineGeometry called
    });

     it('should update confinement and not clamp position if not needed', () => {
      const newConf = {minX: -20, maxX: 20, minY: -20, maxY: 20}; // Larger confinement
      qix.position.set(5, 5); // Position inside new confinement
      const originalPosition = qix.position.clone();

      qix.setConfinement(newConf);

      expect(qix.confinement).toEqual(newConf);
      expect(qix.position.equals(originalPosition)).toBe(true); // Not clamped
    });
  });
});
