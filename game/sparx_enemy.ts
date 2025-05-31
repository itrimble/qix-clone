import * as THREE from 'three';

const SPARX_COLOR = 0xffff00; // Yellow
const FUSE_COLOR = 0xff0000; // Red
const SPARX_SPEED = 0.05; // Adjust as needed (typically slower than Qix)
const FUSE_SPEED_MULTIPLIER = 1.5; // Fuse is 1.5x faster than normal Sparx speed
const SPARX_SIZE = 0.5;   // Size of the Sparx cube

export class SparxEnemy {
  public mesh: THREE.Mesh;
  public position: THREE.Vector2; // Current position
  private currentSegment: number; // 0: bottom, 1: right, 2: top, 3: left
  private direction: number; // 1 for positive (e.g., left to right, bottom to top), -1 for negative
  private speed: number;
  private gridLimit: number;
  private corners: THREE.Vector2[]; // [BL, BR, TR, TL]

  public isFuse: boolean = false;
  private currentTargetTrailPointIndex: number = 0;
  private fuseSpeed: number;
  private currentTrailPoints: THREE.Vector2[] | null = null;
  private originalColor: THREE.Color = new THREE.Color(SPARX_COLOR);
  private fuseColorVal: THREE.Color = new THREE.Color(FUSE_COLOR);

  constructor(
    initialSegment: number,
    initialPosition: THREE.Vector2, // Should be on the initialSegment
    initialDirection: number,
    gridLimitValue: number,
    boundaryCorners: THREE.Vector2[] // Pass BL, BR, TR, TL
  ) {
    this.currentSegment = initialSegment;
    this.position = initialPosition.clone();
    this.direction = initialDirection;
    this.speed = SPARX_SPEED;
    this.fuseSpeed = this.speed * FUSE_SPEED_MULTIPLIER;
    this.gridLimit = gridLimitValue;
    this.corners = boundaryCorners; // Store [BL, BR, TR, TL]

    // Initialize originalColor based on the material's color
    const geometry = new THREE.BoxGeometry(SPARX_SIZE, SPARX_SIZE, SPARX_SIZE);
    const material = new THREE.MeshBasicMaterial({ color: SPARX_COLOR }); // SPARX_COLOR is const
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.set(this.position.x, this.position.y, 0);
    // this.originalColor is already initialized with SPARX_COLOR
  }

  public activateFuseMode(trail: THREE.Vector2[]): void {
    if (trail.length === 0) {
      console.warn("Attempted to activate Fuse mode with an empty trail.");
      return;
    }

    this.isFuse = true;
    this.currentTrailPoints = trail.map(p => p.clone());

    this.position.copy(this.currentTrailPoints[0]);
    this.mesh.position.set(this.position.x, this.position.y, 0);
    this.currentTargetTrailPointIndex = (this.currentTrailPoints.length > 1) ? 1 : 0;

    if (this.mesh.material instanceof THREE.MeshBasicMaterial) {
      this.mesh.material.color.copy(this.fuseColorVal);
    }
    console.log("Sparx activated Fuse mode.");
  }

  private snapToNearestBoundary(): void {
    let closestCorner: THREE.Vector2 | null = null;
    let minDistSq = Infinity;

    if (!this.corners || this.corners.length !== 4) {
        console.error("Sparx: Boundary corners not defined for snapping!");
        this.position.set(-this.gridLimit, -this.gridLimit);
        this.currentSegment = 0; this.direction = 1;
        this.mesh.position.set(this.position.x, this.position.y, 0);
        return;
    }

    for (const corner of this.corners) {
      const distSq = this.position.distanceToSquared(corner);
      if (distSq < minDistSq) {
        minDistSq = distSq;
        closestCorner = corner;
      }
    }

    if (closestCorner) {
      this.position.copy(closestCorner);
      if (closestCorner.equals(this.corners[0])) { // BL
        this.currentSegment = 0; this.direction = 1;
      } else if (closestCorner.equals(this.corners[1])) { // BR
        this.currentSegment = 1; this.direction = 1;
      } else if (closestCorner.equals(this.corners[2])) { // TR
        this.currentSegment = 2; this.direction = -1;
      } else if (closestCorner.equals(this.corners[3])) { // TL
        this.currentSegment = 3; this.direction = -1;
      }
    } else {
        this.position.set(-this.gridLimit, -this.gridLimit);
        this.currentSegment = 0; this.direction = 1;
    }
    this.mesh.position.set(this.position.x, this.position.y, 0);
    console.log(`Sparx snapped to segment ${this.currentSegment} after fuse mode.`);
  }

  public deactivateFuseMode(): void {
    if (!this.isFuse) return;

    this.isFuse = false;
    this.currentTrailPoints = null;
    this.currentTargetTrailPointIndex = 0;

    if (this.mesh.material instanceof THREE.MeshBasicMaterial) {
      this.mesh.material.color.copy(this.originalColor);
    }
    console.log("Sparx deactivated Fuse mode.");
    this.snapToNearestBoundary();
  }

  update(deltaTime: number): void {
    if (this.isFuse) {
      if (!this.currentTrailPoints || this.currentTargetTrailPointIndex >= this.currentTrailPoints.length) {
        console.log("Fuse: No trail or end of its trail copy reached.");
        this.deactivateFuseMode();
        return;
      }

      const targetPoint = this.currentTrailPoints[this.currentTargetTrailPointIndex];
      const directionToTarget = new THREE.Vector2().subVectors(targetPoint, this.position);
      const distanceToTargetSq = directionToTarget.lengthSq();

      const moveDistance = this.fuseSpeed * deltaTime * 50;

      if (distanceToTargetSq <= moveDistance * moveDistance || distanceToTargetSq === 0) {
        this.position.copy(targetPoint);
        this.currentTargetTrailPointIndex++;
        if (this.currentTargetTrailPointIndex >= this.currentTrailPoints.length) {
          console.log("Fuse has reached the end of the provided trail path.");
          // It will now wait at the last point. Collision will handle if player is there.
          // Or, if it should return to patrolling: this.deactivateFuseMode();
        }
      } else {
        directionToTarget.normalize().multiplyScalar(moveDistance);
        this.position.add(directionToTarget);
      }
      this.mesh.position.set(this.position.x, this.position.y, 0);
    } else { // Normal boundary patrolling
      const moveDistance = this.speed * deltaTime * 50;
      switch (this.currentSegment) {
        case 0: // Bottom wall (moving along x-axis)
          this.position.x += this.direction * moveDistance;
          if (this.direction === 1 && this.position.x >= this.corners[1].x) { // Reached BR corner
            this.position.x = this.corners[1].x;
            this.currentSegment = 1;
          } else if (this.direction === -1 && this.position.x <= this.corners[0].x) { // Reached BL corner
            this.position.x = this.corners[0].x;
            this.currentSegment = 3;
            this.direction = -1;
          }
          break;
        case 1: // Right wall (moving along y-axis)
          this.position.y += this.direction * moveDistance;
          if (this.direction === 1 && this.position.y >= this.corners[2].y) { // Reached TR corner
            this.position.y = this.corners[2].y;
            this.currentSegment = 2;
            this.direction = -1;
          } else if (this.direction === -1 && this.position.y <= this.corners[1].y) { // Reached BR corner
            this.position.y = this.corners[1].y;
            this.currentSegment = 0;
            this.direction = -1;
          }
          break;
        case 2: // Top wall (moving along x-axis)
          this.position.x += this.direction * moveDistance;
          if (this.direction === -1 && this.position.x <= this.corners[3].x) { // Reached TL corner
            this.position.x = this.corners[3].x;
            this.currentSegment = 3;
          } else if (this.direction === 1 && this.position.x >= this.corners[2].x) { // Reached TR corner
            this.position.x = this.corners[2].x;
            this.currentSegment = 1;
            this.direction = 1;
          }
          break;
        case 3: // Left wall (moving along y-axis)
          this.position.y += this.direction * moveDistance;
          if (this.direction === -1 && this.position.y <= this.corners[0].y) { // Reached BL corner
            this.position.y = this.corners[0].y;
            this.currentSegment = 0;
            this.direction = 1;
          } else if (this.direction === 1 && this.position.y >= this.corners[3].y) { // Reached TL corner
            this.position.y = this.corners[3].y;
            this.currentSegment = 2;
            this.direction = 1;
          }
          break;
      }
      this.mesh.position.set(this.position.x, this.position.y, 0);
    }
  }

  public reset(initialSegment: number, initialPosition: THREE.Vector2, initialDirection: number): void {
    this.deactivateFuseMode(); // Ensure fuse mode is off before resetting patrol
    this.currentSegment = initialSegment;
    this.position.copy(initialPosition);
    this.direction = initialDirection;
    this.mesh.position.set(this.position.x, this.position.y, 0);
    console.log("Sparx Reset to segment:", initialSegment);
  }
}
