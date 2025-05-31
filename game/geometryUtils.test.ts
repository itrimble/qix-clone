import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import {
  getOrientation,
  onSegment,
  segmentsIntersect,
  createOrderedCorners,
  getSegmentForPoint,
  getBoundaryPath,
  calculateQixPolygons,
} from './geometryUtils';

const gridLimit = 14;

describe('Geometry Utilities', () => {
  describe('segmentsIntersect', () => {
    it('should detect crossing segments', () => {
      const p1 = new THREE.Vector2(0, 0);
      const q1 = new THREE.Vector2(2, 2);
      const p2 = new THREE.Vector2(0, 2);
      const q2 = new THREE.Vector2(2, 0);
      expect(segmentsIntersect(p1, q1, p2, q2)).toBe(true);
    });

    it('should not detect non-crossing segments', () => {
      const p1 = new THREE.Vector2(0, 0);
      const q1 = new THREE.Vector2(1, 1);
      const p2 = new THREE.Vector2(2, 2);
      const q2 = new THREE.Vector2(3, 3);
      expect(segmentsIntersect(p1, q1, p2, q2)).toBe(false);
    });

    it('should detect collinear overlapping segments', () => {
      const p1 = new THREE.Vector2(0, 0);
      const q1 = new THREE.Vector2(2, 2);
      const p2 = new THREE.Vector2(1, 1); // p2 lies on p1q1
      const q2 = new THREE.Vector2(3, 3);
      expect(segmentsIntersect(p1, q1, p2, q2)).toBe(true);
    });

    it('should detect collinear overlapping segments (case 2)', () => {
        const p1 = new THREE.Vector2(0, 0);
        const q1 = new THREE.Vector2(2, 0);
        const p2 = new THREE.Vector2(1, 0);
        const q2 = new THREE.Vector2(3, 0);
        expect(segmentsIntersect(p1, q1, p2, q2)).toBe(true); // p2 on p1q1
    });


    it('should not detect collinear non-overlapping segments', () => {
      const p1 = new THREE.Vector2(0, 0);
      const q1 = new THREE.Vector2(1, 1);
      const p2 = new THREE.Vector2(2, 2); // Segments are collinear but separate
      const q2 = new THREE.Vector2(3, 3);
      expect(segmentsIntersect(p1, q1, p2, q2)).toBe(false); // Should be false by standard definition if not overlapping
    });

    it('should correctly handle collinear segments where one contains the other', () => {
        const p1 = new THREE.Vector2(0, 0);
        const q1 = new THREE.Vector2(4, 0); // p1q1 contains p2q2
        const p2 = new THREE.Vector2(1, 0);
        const q2 = new THREE.Vector2(2, 0);
        expect(segmentsIntersect(p1, q1, p2, q2)).toBe(true);
    });

    it('should return false for segments touching at endpoints (Qix rule)', () => {
      const p1 = new THREE.Vector2(0, 0);
      const q1 = new THREE.Vector2(2, 2);
      const p2 = new THREE.Vector2(2, 2); // p2 touches q1
      const q2 = new THREE.Vector2(3, 3);
      expect(segmentsIntersect(p1, q1, p2, q2)).toBe(false);
    });

    it('should return false if segments share an endpoint but do not cross (p1=p2)', () => {
        const p1 = new THREE.Vector2(0,0);
        const q1 = new THREE.Vector2(1,1);
        const p2 = new THREE.Vector2(0,0);
        const q2 = new THREE.Vector2(1,-1);
        expect(segmentsIntersect(p1, q1, p2, q2)).toBe(false);
    });

    it('should return false if segments share an endpoint but do not cross (q1=q2)', () => {
        const p1 = new THREE.Vector2(0,0);
        const q1 = new THREE.Vector2(1,1);
        const p2 = new THREE.Vector2(0,2);
        const q2 = new THREE.Vector2(1,1);
        expect(segmentsIntersect(p1, q1, p2, q2)).toBe(false);
    });

    it('should handle cases where one segment endpoint lies on the other segment (collinear)', () => {
      const p1 = new THREE.Vector2(0, 0);
      const q1 = new THREE.Vector2(3, 0);
      const p2 = new THREE.Vector2(1, 0); // p2 on p1q1
      const q2 = new THREE.Vector2(4, 0); // q2 not on p1q1
      expect(segmentsIntersect(p1, q1, p2, q2)).toBe(true);
    });

    it('should handle T-junction intersection (endpoint of one on another, not collinear)', () => {
        const p1 = new THREE.Vector2(0, 0);
        const q1 = new THREE.Vector2(4, 0);
        const p2 = new THREE.Vector2(2, 0); // p2 on p1q1
        const q2 = new THREE.Vector2(2, 2); // Forms a T
        expect(segmentsIntersect(p1, q1, p2, q2)).toBe(true); // Standard intersection
    });
  });

  describe('getSegmentForPoint', () => {
    const gl = gridLimit; // 14
    const corners = createOrderedCorners(gl);
    const bl = corners[0]; // -14, -14
    const br = corners[1]; //  14, -14
    const tr = corners[2]; //  14,  14
    const tl = corners[3]; // -14,  14

    it('should identify points on bottom segment (0)', () => {
      expect(getSegmentForPoint(new THREE.Vector2(0, -gl), gl)).toBe(0);
      expect(getSegmentForPoint(bl, gl)).toBe(0); // Corner BL
    });
    it('should identify points on right segment (1)', () => {
      expect(getSegmentForPoint(new THREE.Vector2(gl, 0), gl)).toBe(1);
      expect(getSegmentForPoint(br, gl)).toBe(1); // Corner BR
    });
    it('should identify points on top segment (2)', () => {
      expect(getSegmentForPoint(new THREE.Vector2(0, gl), gl)).toBe(2);
      expect(getSegmentForPoint(tr, gl)).toBe(2); // Corner TR
    });
    it('should identify points on left segment (3)', () => {
      expect(getSegmentForPoint(new THREE.Vector2(-gl, 0), gl)).toBe(3);
      expect(getSegmentForPoint(tl, gl)).toBe(3); // Corner TL
    });
    it('should return -1 for points not on the boundary', () => {
      expect(getSegmentForPoint(new THREE.Vector2(0, 0), gl)).toBe(-1);
      expect(getSegmentForPoint(new THREE.Vector2(gl + 1, gl), gl)).toBe(-1);
    });
  });

  describe('getBoundaryPath', () => {
    const gl = gridLimit; // 14
    const corners = createOrderedCorners(gl);
    const bl = corners[0]; const br = corners[1];
    const tr = corners[2]; const tl = corners[3];

    it('should return path on the same segment (CW)', () => {
      const p1 = new THREE.Vector2(-5, -gl);
      const p2 = new THREE.Vector2(5, -gl);
      const path = getBoundaryPath(p1, p2, true, gl);
      expect(path).toEqual([p1, p2]);
    });

    it('should return path on the same segment (CCW)', () => {
      const p1 = new THREE.Vector2(5, -gl);
      const p2 = new THREE.Vector2(-5, -gl);
      const path = getBoundaryPath(p1, p2, false, gl);
      expect(path).toEqual([p1, p2]);
    });

    it('should return path crossing one corner (CW)', () => {
      const p1 = new THREE.Vector2(10, -gl); // Bottom seg
      const p2 = new THREE.Vector2(gl, 10);  // Right seg
      const path = getBoundaryPath(p1, p2, true, gl);
      expect(path).toEqual([p1, br, p2]);
    });

    it('should return path crossing one corner (CCW)', () => {
      const p1 = new THREE.Vector2(gl, 10);  // Right seg
      const p2 = new THREE.Vector2(10, -gl); // Bottom seg
      const path = getBoundaryPath(p1, p2, false, gl);
      expect(path).toEqual([p1, br, p2]);
    });

    it('should return path crossing multiple corners (CW)', () => {
      const p1 = new THREE.Vector2(0, -gl); // Bottom
      const p2 = new THREE.Vector2(0, gl);  // Top
      const path = getBoundaryPath(p1, p2, true, gl);
      expect(path).toEqual([p1, br, tr, p2]);
    });

    it('should return path crossing multiple corners (CCW)', () => {
      const p1 = new THREE.Vector2(0, gl);  // Top
      const p2 = new THREE.Vector2(0, -gl); // Bottom
      const path = getBoundaryPath(p1, p2, false, gl);
      expect(path).toEqual([p1, tl, bl, p2]);
    });

    it('should return path from a point to itself', () => {
      const p1 = new THREE.Vector2(0, gl);
      const path = getBoundaryPath(p1, p1, true, gl);
      expect(path).toEqual([p1]);
    });

    it('should handle full boundary traversal (CW)', () => {
        const p1 = new THREE.Vector2(0, -gl); // Mid-bottom
        const p2 = new THREE.Vector2(0, -gl); // Same point
        // To make it traverse, p2 should be approached from the other direction
        // This test is more about how getBoundaryPath handles it.
        // If p1 and p2 are identical, it returns [p1].
        // Let's test a path that *almost* completes a loop.
        const pAlmostEnd = new THREE.Vector2(0.1, -gl); // Slightly to the right of p1 for CW
        const pathCW = getBoundaryPath(p1, pAlmostEnd, true, gl);
        expect(pathCW).toEqual([p1, br, tr, tl, bl, pAlmostEnd]);
    });

    it('should handle full boundary traversal (CCW)', () => {
        const p1 = new THREE.Vector2(0, -gl); // Mid-bottom
        const pAlmostEnd = new THREE.Vector2(-0.1, -gl); // Slightly to the left of p1 for CCW
        const pathCCW = getBoundaryPath(p1, pAlmostEnd, false, gl);
        expect(pathCCW).toEqual([p1, tl, tr, br, bl, pAlmostEnd]);
    });
  });

  describe('calculateQixPolygons', () => {
    const gl = gridLimit; // 14
    const corners = createOrderedCorners(gl);
    const bl = corners[0]; const br = corners[1];
    const tr = corners[2]; const tl = corners[3];

    it('should calculate polygons for a simple corner cut', () => {
      // Trail cuts the bottom-left corner
      const playerTrail = [
        new THREE.Vector2(-5, -gl), // Starts on bottom edge
        new THREE.Vector2(-gl, -5)  // Ends on left edge
      ];
      const { polygon1, polygon2 } = calculateQixPolygons(playerTrail, gl);

      // Polygon 1 (trail + CW boundary from end to start)
      // Trail: (-5,-14) -> (-14,-5)
      // CW Boundary from (-14,-5) to (-5,-14): (-14,-5) -> (-14,-14) -> (-5,-14)
      // Expected poly1: (-5,-14), (-14,-5), (-14,-14)
      const expectedPoly1 = [
        playerTrail[0],
        playerTrail[1],
        bl, // Corner passed going CW from left edge to bottom edge
      ];
      expect(polygon1.length).toBe(expectedPoly1.length);
      polygon1.forEach((pt, i) => expect(pt.equals(expectedPoly1[i])).toBe(true));


      // Polygon 2 (trail + CCW boundary from end to start)
      // Trail: (-5,-14) -> (-14,-5)
      // CCW Boundary from (-14,-5) to (-5,-14): (-14,-5) -> (-14,14) -> (14,14) -> (14,-14) -> (-5,-14)
      // Expected poly2: (-5,-14), (-14,-5), tl, tr, br
      const expectedPoly2 = [
        playerTrail[0],
        playerTrail[1],
        tl, tr, br,
      ];
      expect(polygon2.length).toBe(expectedPoly2.length);
      polygon2.forEach((pt, i) => expect(pt.equals(expectedPoly2[i])).toBe(true));
    });

    it('should calculate polygons for a U-shape cutting into the area', () => {
      // Trail starts on bottom, goes up, right, then down to right edge
      const playerTrail = [
        new THREE.Vector2(-5, -gl), // Start on bottom
        new THREE.Vector2(-5, 0),   // Goes up
        new THREE.Vector2(5, 0),    // Goes right
        new THREE.Vector2(5, -gl)   // Goes down to bottom edge
      ];
      const { polygon1, polygon2 } = calculateQixPolygons(playerTrail, gl);

      // Polygon 1 (trail + CW from (5,-14) to (-5,-14))
      // CW Boundary: (5,-14) -> (-5,-14) (direct on same segment)
      // Expected poly1: (-5,-14), (-5,0), (5,0), (5,-14)
      const expectedPoly1 = [...playerTrail]; // This forms the smaller polygon
      expect(polygon1.length).toBe(expectedPoly1.length);
      polygon1.forEach((pt, i) => expect(pt.equals(expectedPoly1[i])).toBe(true));

      // Polygon 2 (trail + CCW from (5,-14) to (-5,-14))
      // CCW Boundary: (5,-14) -> (14,-14) -> (14,14) -> (-14,14) -> (-14,-14) -> (-5,-14)
      // Expected poly2: (-5,-14), (-5,0), (5,0), (5,-14), br, tr, tl, bl
      const expectedPoly2 = [
        ...playerTrail,
        br, tr, tl, bl,
      ];
      expect(polygon2.length).toBe(expectedPoly2.length);
      polygon2.forEach((pt, i) => expect(pt.equals(expectedPoly2[i])).toBe(true));
    });

    it('should return empty polygons if trail is too short', () => {
        const playerTrail = [new THREE.Vector2(0, -gl)];
        const { polygon1, polygon2 } = calculateQixPolygons(playerTrail, gl);
        expect(polygon1).toEqual([]);
        expect(polygon2).toEqual([]);
    });
  });
});
