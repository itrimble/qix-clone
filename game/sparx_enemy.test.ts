import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';
import { SparxEnemy, SPARX_COLOR, FUSE_COLOR, SPARX_SIZE, SPARX_SPEED, FUSE_SPEED_MULTIPLIER } from './sparx_enemy';

const testGridLimit = 14;
const testCorners = [
  new THREE.Vector2(-testGridLimit, -testGridLimit), // 0: BL
  new THREE.Vector2(testGridLimit, -testGridLimit),  // 1: BR
  new THREE.Vector2(testGridLimit, testGridLimit),   // 2: TR
  new THREE.Vector2(-testGridLimit, testGridLimit),  // 3: TL
];
const FUSE_SPEED = SPARX_SPEED * FUSE_SPEED_MULTIPLIER;
const MOVE_FACTOR = 50; // Factor from SparxEnemy.update

describe('SparxEnemy', () => {
  let sparx: SparxEnemy;

  beforeEach(() => {
    // Default Sparx for many tests, can be overridden
    sparx = new SparxEnemy(0, testCorners[0].clone(), 1, testGridLimit, testCorners.map(c => c.clone()));
    vi.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with correct defaults and provided options', () => {
      expect(sparx.mesh).toBeInstanceOf(THREE.Mesh);
      expect(sparx.mesh.geometry).toBeInstanceOf(THREE.BoxGeometry);
      expect((sparx.mesh.material as THREE.MeshBasicMaterial).color.getHex()).toBe(SPARX_COLOR);
      // Check size (BoxGeometry constructor args)
      const geometryParams = (sparx.mesh.geometry as THREE.BoxGeometry).parameters;
      expect(geometryParams.width).toBe(SPARX_SIZE);
      expect(geometryParams.height).toBe(SPARX_SIZE);
      expect(geometryParams.depth).toBe(SPARX_SIZE);

      expect(sparx.currentSegment).toBe(0);
      expect(sparx.position.equals(testCorners[0])).toBe(true);
      expect(sparx.mesh.position.x).toBe(testCorners[0].x);
      expect(sparx.mesh.position.y).toBe(testCorners[0].y);
      expect(sparx.direction).toBe(1);
      expect(sparx.speed).toBe(SPARX_SPEED);
      expect(sparx.gridLimit).toBe(testGridLimit);
      expect(sparx.corners).toEqual(testCorners);
      expect(sparx.isFuse).toBe(false);
    });
  });

  describe('Normal Boundary Patrolling', () => {
    const deltaTime = 0.016; // Approx 60 FPS
    const moveAmount = SPARX_SPEED * MOVE_FACTOR * deltaTime;

    // Test moving from BL (0) towards BR (1) on segment 0
    it('should patrol segment 0 (bottom) correctly', () => {
      sparx.reset(0, testCorners[0].clone(), 1); // Start BL, dir positive

      // Move part way
      sparx.update(deltaTime);
      expect(sparx.position.x).toBeCloseTo(testCorners[0].x + moveAmount);
      expect(sparx.position.y).toBeCloseTo(testCorners[0].y);
      expect(sparx.currentSegment).toBe(0);

      // Move to pass the corner (BR)
      const distanceToCorner = testCorners[1].x - sparx.position.x;
      const stepsToCorner = Math.ceil(distanceToCorner / moveAmount) +1; // one extra step to ensure passing
      for (let i = 0; i < stepsToCorner; i++) {
        sparx.update(deltaTime);
      }
      expect(sparx.position.equals(testCorners[1])).toBe(true); // Snapped to BR corner
      expect(sparx.currentSegment).toBe(1); // Now on right segment
      expect(sparx.direction).toBe(1); // Moving up
    });

    // Test moving from BR (1) towards TR (2) on segment 1
    it('should patrol segment 1 (right) correctly', () => {
      sparx.reset(1, testCorners[1].clone(), 1); // Start BR, dir positive (up)
      sparx.update(deltaTime);
      expect(sparx.position.y).toBeCloseTo(testCorners[1].y + moveAmount);
      expect(sparx.position.x).toBeCloseTo(testCorners[1].x);
      expect(sparx.currentSegment).toBe(1);

      const distanceToCorner = testCorners[2].y - sparx.position.y;
      const stepsToCorner = Math.ceil(distanceToCorner / moveAmount) + 1;
      for (let i = 0; i < stepsToCorner; i++) sparx.update(deltaTime);
      expect(sparx.position.equals(testCorners[2])).toBe(true); // Snapped to TR
      expect(sparx.currentSegment).toBe(2); // Now on top segment
      expect(sparx.direction).toBe(-1); // Moving left (negative X)
    });

    // Test moving from TR (2) towards TL (3) on segment 2
    it('should patrol segment 2 (top) correctly', () => {
      sparx.reset(2, testCorners[2].clone(), -1); // Start TR, dir negative (left)
      sparx.update(deltaTime);
      expect(sparx.position.x).toBeCloseTo(testCorners[2].x - moveAmount);
      expect(sparx.position.y).toBeCloseTo(testCorners[2].y);
      expect(sparx.currentSegment).toBe(2);

      const distanceToCorner = sparx.position.x - testCorners[3].x; // target is TL
      const stepsToCorner = Math.ceil(distanceToCorner / moveAmount) + 1;
      for (let i = 0; i < stepsToCorner; i++) sparx.update(deltaTime);
      expect(sparx.position.equals(testCorners[3])).toBe(true); // Snapped to TL
      expect(sparx.currentSegment).toBe(3); // Now on left segment
      expect(sparx.direction).toBe(-1); // Moving down (negative Y)
    });

    // Test moving from TL (3) towards BL (0) on segment 3
    it('should patrol segment 3 (left) correctly', () => {
      sparx.reset(3, testCorners[3].clone(), -1); // Start TL, dir negative (down)
      sparx.update(deltaTime);
      expect(sparx.position.y).toBeCloseTo(testCorners[3].y - moveAmount);
      expect(sparx.position.x).toBeCloseTo(testCorners[3].x);
      expect(sparx.currentSegment).toBe(3);

      const distanceToCorner = sparx.position.y - testCorners[0].y; // target is BL
      const stepsToCorner = Math.ceil(distanceToCorner / moveAmount) + 1;
      for (let i = 0; i < stepsToCorner; i++) sparx.update(deltaTime);
      expect(sparx.position.equals(testCorners[0])).toBe(true); // Snapped to BL
      expect(sparx.currentSegment).toBe(0); // Now on bottom segment
      expect(sparx.direction).toBe(1); // Moving right (positive X)
    });
  });

  describe('Fuse Mode', () => {
    const fuseMoveAmount = FUSE_SPEED * MOVE_FACTOR * 0.016; // approx one frame

    it('activateFuseMode should set fuse state and snap to trail start', () => {
      const trail = [new THREE.Vector2(1, 1), new THREE.Vector2(2, 2)];
      sparx.activateFuseMode(trail);

      expect(sparx.isFuse).toBe(true);
      expect(sparx.currentTrailPoints).toEqual(trail);
      expect(sparx.position.equals(trail[0])).toBe(true);
      expect(sparx.mesh.position.x).toBe(trail[0].x);
      expect(sparx.mesh.position.y).toBe(trail[0].y);
      expect(sparx.currentTargetTrailPointIndex).toBe(1);
      expect((sparx.mesh.material as THREE.MeshBasicMaterial).color.getHex()).toBe(FUSE_COLOR);
    });

    it('activateFuseMode should handle empty trail by not activating', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn');
      sparx.activateFuseMode([]);
      expect(sparx.isFuse).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith("Attempted to activate Fuse mode with an empty trail.");
    });

    it('activateFuseMode with single point trail should target index 0', () => {
        const trail = [new THREE.Vector2(1,1)];
        sparx.activateFuseMode(trail);
        expect(sparx.isFuse).toBe(true);
        expect(sparx.currentTargetTrailPointIndex).toBe(0); // Stays at the only point
    });

    it('update in Fuse Mode should move towards next trail point', () => {
      const trail = [new THREE.Vector2(0, 0), new THREE.Vector2(10, 0)];
      sparx.activateFuseMode(trail); // Starts at (0,0), targets (10,0)

      sparx.update(0.016); // Move for one frame

      expect(sparx.position.x).toBeCloseTo(fuseMoveAmount);
      expect(sparx.position.y).toBeCloseTo(0);
      expect(sparx.currentTargetTrailPointIndex).toBe(1); // Still targeting (10,0)
    });

    it('update in Fuse Mode should snap to point and increment target', () => {
      const trail = [new THREE.Vector2(0, 0), new THREE.Vector2(0.1, 0), new THREE.Vector2(0.2, 0.2)];
      sparx.activateFuseMode(trail); // Starts at (0,0), targets (0.1,0) which is close

      // One update should be enough to reach or pass (0.1,0) given FUSE_SPEED
      // fuseMoveAmount is approx 0.06 for speed 0.075, dt 0.016, factor 50.
      // Recalculate based on current FUSE_SPEED:
      const actualFuseSpeed = SPARX_SPEED * FUSE_SPEED_MULTIPLIER; // 0.05 * 1.5 = 0.075
      const actualFuseMoveAmount = actualFuseSpeed * MOVE_FACTOR * 0.016; // 0.075 * 50 * 0.016 = 0.06

      sparx.update(0.016); // Moves approx 0.06. Initial point (0,0), target (0.1,0)
      // Since 0.06 < 0.1, it does not reach yet.
      expect(sparx.position.x).toBeCloseTo(actualFuseMoveAmount);
      expect(sparx.currentTargetTrailPointIndex).toBe(1);

      // Need more steps or longer deltaTime to reach (0.1,0)
      sparx.position.set(0.09,0,0); // Manually set closer
      sparx.update(0.016); // Should now pass 0.1 and snap

      expect(sparx.position.equals(trail[1])).toBe(true); // Snapped to (0.1,0)
      expect(sparx.currentTargetTrailPointIndex).toBe(2); // Now targets (0.2,0.2)
    });

    it('update in Fuse Mode should stay at last point if end of trail is reached', () => {
      const trail = [new THREE.Vector2(0, 0), new THREE.Vector2(0.05, 0)];
      sparx.activateFuseMode(trail);

      sparx.update(0.016); // Should reach/pass (0.05,0) and snap
      expect(sparx.position.equals(trail[1])).toBe(true);
      expect(sparx.currentTargetTrailPointIndex).toBe(1); // Stays targeting the last point's index

      sparx.update(0.016); // Another update
      expect(sparx.position.equals(trail[1])).toBe(true); // Should not move
    });

    it('deactivateFuseMode should reset state and snap to boundary', () => {
      const trail = [new THREE.Vector2(1, 1)]; // Sparx is at (1,1) in fuse mode
      sparx.activateFuseMode(trail);

      sparx.deactivateFuseMode();

      expect(sparx.isFuse).toBe(false);
      expect((sparx.mesh.material as THREE.MeshBasicMaterial).color.getHex()).toBe(SPARX_COLOR);

      // Check snapToNearestBoundary logic (it snaps to the corner of the segment it's closest to's start)
      // (1,1) is closest to BL corner (-14,-14) among the segment start points.
      // Let's analyze snapToNearestBoundary:
      // It finds the closest *corner*. (1,1) is closest to BL,BR,TR,TL in this order:
      // dist to BL(-14,-14) = sqrt(15^2+15^2) = sqrt(450) approx 21.2
      // dist to BR(14,-14) = sqrt(13^2+15^2) = sqrt(169+225)=sqrt(394) approx 19.8
      // dist to TR(14,14) = sqrt(13^2+13^2) = sqrt(169+169)=sqrt(338) approx 18.3
      // dist to TL(-14,14) = sqrt(15^2+13^2) = sqrt(225+169)=sqrt(394) approx 19.8
      // So it snaps to TR (testCorners[2]).
      expect(sparx.position.equals(testCorners[2])).toBe(true); // Snapped to TR
      expect(sparx.currentSegment).toBe(2); // Top segment
      // Direction depends on which half of segment it's on. For TR, it becomes -1 (left)
      expect(sparx.direction).toBe(-1);
    });
  });

  describe('reset', () => {
    it('should reset Sparx state and deactivate fuse mode', () => {
      const trail = [new THREE.Vector2(1, 1)];
      sparx.activateFuseMode(trail); // Ensure fuse is active
      expect(sparx.isFuse).toBe(true);
      expect((sparx.mesh.material as THREE.MeshBasicMaterial).color.getHex()).toBe(FUSE_COLOR);

      const resetPos = testCorners[1].clone();
      sparx.reset(1, resetPos, -1);

      expect(sparx.isFuse).toBe(false);
      expect((sparx.mesh.material as THREE.MeshBasicMaterial).color.getHex()).toBe(SPARX_COLOR);
      expect(sparx.currentSegment).toBe(1);
      expect(sparx.position.equals(resetPos)).toBe(true);
      expect(sparx.mesh.position.x).toBe(resetPos.x);
      expect(sparx.mesh.position.y).toBe(resetPos.y);
      expect(sparx.direction).toBe(-1);
    });
  });
});
