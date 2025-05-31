import * as THREE from 'three';

const SPARX_COLOR = 0xffff00; // Yellow
const SPARX_SPEED = 0.05; // Adjust as needed (typically slower than Qix)
const SPARX_SIZE = 0.5;   // Size of the Sparx cube

export class SparxEnemy {
  public mesh: THREE.Mesh;
  public position: THREE.Vector2; // Current position
  private currentSegment: number; // 0: bottom, 1: right, 2: top, 3: left
  private direction: number; // 1 for positive (e.g., left to right, bottom to top), -1 for negative
  private speed: number;
  private gridLimit: number;
  private corners: THREE.Vector2[]; // [BL, BR, TR, TL]

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
    this.gridLimit = gridLimitValue;
    this.corners = boundaryCorners; // Store [BL, BR, TR, TL]

    const geometry = new THREE.BoxGeometry(SPARX_SIZE, SPARX_SIZE, SPARX_SIZE);
    const material = new THREE.MeshBasicMaterial({ color: SPARX_COLOR });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.set(this.position.x, this.position.y, 0);
  }

  update(deltaTime: number): void {
    const moveDistance = this.speed * deltaTime * 50; // Adjust multiplier as needed if speed is too slow/fast

    switch (this.currentSegment) {
      case 0: // Bottom wall (moving along x-axis)
        this.position.x += this.direction * moveDistance;
        if (this.direction === 1 && this.position.x >= this.corners[1].x) { // Reached BR corner
          this.position.x = this.corners[1].x;
          this.currentSegment = 1; // Transition to Right wall
          // Direction remains 1 (moving up)
        } else if (this.direction === -1 && this.position.x <= this.corners[0].x) { // Reached BL corner
          this.position.x = this.corners[0].x;
          this.currentSegment = 3; // Transition to Left wall
          this.direction = -1; // Moving down (but left wall is y-axis, so this means from TL to BL)
        }
        break;
      case 1: // Right wall (moving along y-axis)
        this.position.y += this.direction * moveDistance;
        if (this.direction === 1 && this.position.y >= this.corners[2].y) { // Reached TR corner
          this.position.y = this.corners[2].y;
          this.currentSegment = 2; // Transition to Top wall
          this.direction = -1; // Moving left
        } else if (this.direction === -1 && this.position.y <= this.corners[1].y) { // Reached BR corner
          this.position.y = this.corners[1].y;
          this.currentSegment = 0; // Transition to Bottom wall
          this.direction = -1; // Moving left
        }
        break;
      case 2: // Top wall (moving along x-axis)
        this.position.x += this.direction * moveDistance;
        if (this.direction === -1 && this.position.x <= this.corners[3].x) { // Reached TL corner
          this.position.x = this.corners[3].x;
          this.currentSegment = 3; // Transition to Left wall
          // Direction remains -1 (moving down)
        } else if (this.direction === 1 && this.position.x >= this.corners[2].x) { // Reached TR corner
          this.position.x = this.corners[2].x;
          this.currentSegment = 1; // Transition to Right wall
          this.direction = 1; // Moving up
        }
        break;
      case 3: // Left wall (moving along y-axis)
        this.position.y += this.direction * moveDistance;
        if (this.direction === -1 && this.position.y <= this.corners[0].y) { // Reached BL corner
          this.position.y = this.corners[0].y;
          this.currentSegment = 0; // Transition to Bottom wall
          this.direction = 1; // Moving right
        } else if (this.direction === 1 && this.position.y >= this.corners[3].y) { // Reached TL corner
          this.position.y = this.corners[3].y;
          this.currentSegment = 2; // Transition to Top wall
          this.direction = 1; // Moving right
        }
        break;
    }
    this.mesh.position.set(this.position.x, this.position.y, 0);
  }

  public reset(initialSegment: number, initialPosition: THREE.Vector2, initialDirection: number): void {
    this.currentSegment = initialSegment;
    this.position.copy(initialPosition);
    this.direction = initialDirection;
    this.mesh.position.set(this.position.x, this.position.y, 0);
    console.log("Sparx Reset to segment:", initialSegment);
  }
}
