import * as THREE from 'three';

// --- Intersection Detection Utilities ---

// Helper function to find orientation of ordered triplet (p, q, r).
// Returns 0 if p, q, r are collinear, 1 if clockwise, 2 if counterclockwise.
export function getOrientation(p: THREE.Vector2, q: THREE.Vector2, r: THREE.Vector2): number {
  const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
  if (val === 0) return 0; // Collinear
  return (val > 0) ? 1 : 2; // Clockwise or Counterclockwise
}

// Helper function to check if point q lies on segment pr.
export function onSegment(p: THREE.Vector2, q: THREE.Vector2, r: THREE.Vector2): boolean {
  return (q.x <= Math.max(p.x, r.x) && q.x >= Math.min(p.x, r.x) &&
          q.y <= Math.max(p.y, r.y) && q.y >= Math.min(p.y, r.y));
}

export function segmentsIntersect(p1: THREE.Vector2, q1: THREE.Vector2, p2: THREE.Vector2, q2: THREE.Vector2): boolean {
  const o1 = getOrientation(p1, q1, p2);
  const o2 = getOrientation(p1, q1, q2);
  const o3 = getOrientation(p2, q2, p1);
  const o4 = getOrientation(p2, q2, q1);

  // General case: segments cross each other
  if (o1 !== 0 && o2 !== 0 && o3 !== 0 && o4 !== 0) {
     if (o1 !== o2 && o3 !== o4) {
         // Prevent intersection if endpoints are merely touching
         if (p1.equals(p2) || p1.equals(q2) || q1.equals(p2) || q1.equals(q2)) {
             return false;
         }
         return true;
     }
  }

  // Special Cases for collinearity:
  if (o1 === 0 && onSegment(p1, p2, q1)) return true;
  if (o2 === 0 && onSegment(p1, q2, q1)) return true;
  if (o3 === 0 && onSegment(p2, p1, q2)) return true;
  if (o4 === 0 && onSegment(p2, q1, q2)) return true;

  return false;
}

// --- Qix Polygon Calculation Utilities ---

export const createOrderedCorners = (gl: number): THREE.Vector2[] => [
    new THREE.Vector2(-gl, -gl), // blCorner
    new THREE.Vector2(gl, -gl),  // brCorner
    new THREE.Vector2(gl, gl),   // trCorner
    new THREE.Vector2(-gl, gl)   // tlCorner
];

// Individual corners can be derived if needed, but orderedCorners is generally more useful.
// If direct export of blCorner etc. is still desired:
// export const blCorner = (gl: number) => new THREE.Vector2(-gl, -gl);
// export const brCorner = (gl: number) => new THREE.Vector2(gl, -gl);
// ... and so on. For now, createOrderedCorners is the main export for corners.


export function getSegmentForPoint(point: THREE.Vector2, gl: number): number {
  const corners = createOrderedCorners(gl);
  const bl = corners[0];
  const br = corners[1];
  const tr = corners[2];
  const tl = corners[3];

  // Check with a small epsilon for floating point comparisons on boundaries
  const epsilon = 0.00001;

  if (Math.abs(point.y - (-gl)) < epsilon && point.x > -gl - epsilon && point.x < gl + epsilon) return 0; // Bottom
  if (Math.abs(point.x - gl) < epsilon && point.y > -gl - epsilon && point.y < gl + epsilon) return 1;  // Right
  if (Math.abs(point.y - gl) < epsilon && point.x < gl + epsilon && point.x > -gl - epsilon) return 2;   // Top
  if (Math.abs(point.x - (-gl)) < epsilon && point.y < gl + epsilon && point.y > -gl - epsilon) return 3; // Left

  // Explicit corner checks using .equals might be too strict with floating points if points are calculated
  // It's generally better if points are snapped to exact corner coords if they are meant to be corners.
  // The segment checks above with epsilon should correctly classify points *on* the boundary line,
  // including endpoints if they are exactly on -gl or gl.
  // If a point is exactly a corner, it will be classified by one of the above segment checks.
  // For example, (-gl, -gl) will be caught by point.y === -gl (bottom segment).
  // To assign corners to specific segments as their "start":
  if (point.equals(bl)) return 0;
  if (point.equals(br)) return 1;
  if (point.equals(tr)) return 2;
  if (point.equals(tl)) return 3;

  console.warn(`Point ${point.x},${point.y} is not on boundary or corner for gl=${gl}.`);
  return -1;
}

export function getBoundaryPath(p1: THREE.Vector2, p2: THREE.Vector2, isClockwise: boolean, gl: number): THREE.Vector2[] {
  const orderedCorners = createOrderedCorners(gl);
  const path: THREE.Vector2[] = [p1.clone()];
  let currentSeg = getSegmentForPoint(p1, gl);
  const targetSeg = getSegmentForPoint(p2, gl);

  if (p1.equals(p2)) return [p1.clone()];

  if (currentSeg === -1) {
    console.error("getBoundaryPath: p1 is not on a valid segment", p1, gl);
    return path; // Return path with only p1
  }
  if (targetSeg === -1) {
    console.error("getBoundaryPath: p2 is not on a valid segment", p2, gl);
    path.push(p2.clone()); // Add p2 and return
    return path;
  }

  for (let i = 0; i < 8; i++) { // Max 4 segments + buffer
    if (currentSeg === targetSeg && (path[path.length -1].equals(p1) || path[path.length-1].equals(orderedCorners[currentSeg]) || path[path.length-1].equals(orderedCorners[(currentSeg+1)%4]))) {
        // If on the same segment, and the last point added was p1 or a corner leading to this segment,
        // we might not need to add more corners before p2.
        // This condition is tricky; the main goal is to reach p2.
        // If currentSeg === targetSeg, path should end with p2.
        // The loop adds corners until targetSeg is reached or p2 is added.
        // If currentSeg === targetSeg, and last point added is not p2, then p2 should be the next.
        // This usually means p1 and p2 are on the same segment.
        break;
    }

    let cornerToAdd: THREE.Vector2;
    if (isClockwise) {
      cornerToAdd = orderedCorners[(currentSeg + 1) % 4];
      currentSeg = (currentSeg + 1) % 4;
    } else { // Counter-clockwise
      // currentSeg is where p1 is. For CCW, the "next" corner is orderedCorners[currentSeg] itself.
      // Then the segment becomes the one "before" currentSeg.
      cornerToAdd = orderedCorners[currentSeg];
      currentSeg = (currentSeg + 3) % 4;
    }
    path.push(cornerToAdd.clone());
    if (cornerToAdd.equals(p2)) break; // Reached target point p2 by adding a corner

    if (path.length > 6) {
        console.error("getBoundaryPath exceeded max iterations", p1, p2, isClockwise);
        break;
    }
  }

  if (!path[path.length-1].equals(p2)) {
    path.push(p2.clone());
  }
  return path;
}

export function calculateQixPolygons(playerTrail: THREE.Vector2[], gl: number): { polygon1: THREE.Vector2[], polygon2: THREE.Vector2[] } {
  if (playerTrail.length < 2) {
    console.warn("calculateQixPolygons: Player trail too short.");
    return { polygon1: [], polygon2: [] };
  }
  const startTrailNode = playerTrail[0];
  const endTrailNode = playerTrail[playerTrail.length - 1];

  const boundaryPathCW = getBoundaryPath(endTrailNode, startTrailNode, true, gl);
  const boundaryPathCCW = getBoundaryPath(endTrailNode, startTrailNode, false, gl);

  const polygon1Vertices = [...playerTrail.map(p=>p.clone()), ...boundaryPathCW.slice(1)];
  const polygon2Vertices = [...playerTrail.map(p=>p.clone()), ...boundaryPathCCW.slice(1)];

  // Remove duplicate if trail start/end forms a closed loop with boundary path
  if (polygon1Vertices.length > 1 && polygon1Vertices[polygon1Vertices.length - 1].equals(polygon1Vertices[0])) {
     polygon1Vertices.pop();
  }
  if (polygon2Vertices.length > 1 && polygon2Vertices[polygon2Vertices.length - 1].equals(polygon2Vertices[0])) {
     polygon2Vertices.pop();
  }

  return { polygon1: polygon1Vertices, polygon2: polygon2Vertices };
}
