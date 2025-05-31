import * as THREE from 'three';

const QIX_COLOR = 0xff00ff; // Magenta
const QIX_SPEED = 0.1; // Adjust as needed
const NUM_SEGMENTS = 5; // Number of points in the Qix line
const SEGMENT_LENGTH = 0.8; // Length of each segment, adjust for visual
const ANIMATION_SPEED = 0.1; // How fast the Qix body undulates

export class QixEnemy {
  public mesh: THREE.Line;
  private points: THREE.Vector2[] = [];
  private position: THREE.Vector2; // Center position
  private velocity: THREE.Vector2;
  private confinement: { minX: number, maxX: number, minY: number, maxY: number };
  private time: number = 0; // For animation
  public isFrozen: boolean = false;

  constructor(initialPosition: THREE.Vector2, confinementRect: { minX: number, maxX: number, minY: number, maxY: number }) {
    this.position = initialPosition;
    this.confinement = confinementRect;

    // Initial random velocity
    const angle = Math.random() * Math.PI * 2;
    this.velocity = new THREE.Vector2(Math.cos(angle) * QIX_SPEED, Math.sin(angle) * QIX_SPEED);

    // Initialize points for the line relative to position (e.g., a horizontal line initially)
    for (let i = 0; i < NUM_SEGMENTS; i++) {
      this.points.push(new THREE.Vector2((i - Math.floor(NUM_SEGMENTS / 2)) * SEGMENT_LENGTH, 0));
    }

    const material = new THREE.LineBasicMaterial({ color: QIX_COLOR });
    const geometry = new THREE.BufferGeometry(); // Will be updated
    this.mesh = new THREE.Line(geometry, material);

    this.updateLineGeometry();
  }

  private updateLineGeometry(): void {
     const currentAbsolutePoints: THREE.Vector3[] = [];
     this.points.forEach((p, index) => {
         // Simple undulation for body animation
         const offsetX = Math.sin(this.time + index * 0.5) * SEGMENT_LENGTH * 0.3;
         const offsetY = Math.cos(this.time + index * 0.7) * SEGMENT_LENGTH * 0.3;

         currentAbsolutePoints.push(new THREE.Vector3(
             this.position.x + p.x + offsetX,
             this.position.y + p.y + offsetY,
             0 // Z is 0 for 2D plane
         ));
     });
     this.mesh.geometry.setFromPoints(currentAbsolutePoints);
     this.mesh.geometry.computeBoundingSphere(); // Important for some collision checks if we use it
  }

  public update(deltaTime: number, capturedShapes: THREE.Shape[] = []): void {
    if (this.isFrozen) {
      return; // Completely skip update if frozen
    }
    this.time += ANIMATION_SPEED * deltaTime * 50; // deltaTime can be small, scale it

    const oldPosition = this.position.clone();

    // Tentatively update position based on velocity
    this.position.x += this.velocity.x;
    this.position.y += this.velocity.y;

    let bouncedOffCapturedArea = false;
    if (capturedShapes && capturedShapes.length > 0) {
      const currentPositionVec2 = new THREE.Vector2(this.position.x, this.position.y);
      for (const shape of capturedShapes) {
        if (shape.containsPoint(currentPositionVec2)) {
          this.position.copy(oldPosition);
          this.velocity.x *= -1;
          this.velocity.y *= -1;
          console.log("Qix bounced off captured area!");
          bouncedOffCapturedArea = true;
          break;
        }
      }
    }

    // Original outer wall bouncing logic
    if (this.position.x <= this.confinement.minX || this.position.x >= this.confinement.maxX) {
      if (!bouncedOffCapturedArea ||
          (this.position.x <= this.confinement.minX && this.velocity.x < 0) ||
          (this.position.x >= this.confinement.maxX && this.velocity.x > 0) ) {
          this.velocity.x *= -1;
      }
      this.position.x = Math.max(this.confinement.minX, Math.min(this.confinement.maxX, this.position.x));
    }
    if (this.position.y <= this.confinement.minY || this.position.y >= this.confinement.maxY) {
      if (!bouncedOffCapturedArea ||
          (this.position.y <= this.confinement.minY && this.velocity.y < 0) ||
          (this.position.y >= this.confinement.maxY && this.velocity.y > 0) ) {
          this.velocity.y *= -1;
      }
      this.position.y = Math.max(this.confinement.minY, Math.min(this.confinement.maxY, this.position.y));
    }

    this.updateLineGeometry();
  }

  // Getter for the Qix's current line segments (world coordinates) for collision detection
  public getLineSegments(): {p1: THREE.Vector2, p2: THREE.Vector2}[] {
     const segments: {p1: THREE.Vector2, p2: THREE.Vector2}[] = [];
     const geometryPoints = this.mesh.geometry.attributes.position;
     if (!geometryPoints || geometryPoints.count < 2) return [];

     for (let i = 0; i < geometryPoints.count - 1; i++) {
         segments.push({
             p1: new THREE.Vector2(geometryPoints.getX(i), geometryPoints.getY(i)),
             p2: new THREE.Vector2(geometryPoints.getX(i+1), geometryPoints.getY(i+1))
         });
     }
     return segments;
  }

  public reset(initialPosition: THREE.Vector2, confinementRect: { minX: number, maxX: number, minY: number, maxY: number }): void {
    this.position.copy(initialPosition);
    this.confinement = confinementRect; // In case it changes, though unlikely for now

    const angle = Math.random() * Math.PI * 2;
    this.velocity.set(Math.cos(angle) * QIX_SPEED, Math.sin(angle) * QIX_SPEED); // QIX_SPEED is a const in this file

    this.isFrozen = false;
    this.time = 0; // Reset animation time
    this.updateLineGeometry();
    console.log("Qix Reset.");
  }

  public setConfinement(newConfinement: { minX: number, maxX: number, minY: number, maxY: number }): void {
    this.confinement = { ...newConfinement };
    console.log("QixEnemy internal confinement updated to:", this.confinement);

    const preClampX = this.position.x;
    const preClampY = this.position.y;

    this.position.x = Math.max(this.confinement.minX, Math.min(this.confinement.maxX, this.position.x));
    this.position.y = Math.max(this.confinement.minY, Math.min(this.confinement.maxY, this.position.y));

    if (this.position.x !== preClampX || this.position.y !== preClampY) {
       console.log("QixEnemy position clamped within new confinement by setConfinement.");
    }
    this.updateLineGeometry();
  }
}
