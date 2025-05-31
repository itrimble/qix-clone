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

  update(deltaTime: number): void {
    this.time += ANIMATION_SPEED * deltaTime * 50; // deltaTime can be small, scale it

    // Move position
    this.position.x += this.velocity.x;
    this.position.y += this.velocity.y;

    // Bounce off confinement walls
    if (this.position.x <= this.confinement.minX || this.position.x >= this.confinement.maxX) {
      this.velocity.x *= -1;
      this.position.x = Math.max(this.confinement.minX, Math.min(this.confinement.maxX, this.position.x)); // Clamp
    }
    if (this.position.y <= this.confinement.minY || this.position.y >= this.confinement.maxY) {
      this.velocity.y *= -1;
      this.position.y = Math.max(this.confinement.minY, Math.min(this.confinement.maxY, this.position.y)); // Clamp
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
}
