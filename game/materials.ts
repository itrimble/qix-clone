import * as THREE from 'three';

// --- Player Material ---
export const playerMaterial = new THREE.MeshPhongMaterial({
  color: 0x00cc00,      // Slightly darker, less neon green
  emissive: 0x002200,   // Darker emissive
  shininess: 50,        
  specular: 0x005500,   
  flatShading: false,    // Set to true for a more faceted, low-poly retro look
});

// --- Enemy Material ---
// Default enemy material
export const enemyMaterial = new THREE.MeshPhongMaterial({
  color: 0xcc0000,      // Slightly darker, less neon red
  emissive: 0x220000,   
  shininess: 50,
  specular: 0x550000,
  flatShading: false,    // Set to true for a more faceted, low-poly retro look
});

// Example for a potential second enemy type, or special enemies
export const enemyType2Material = new THREE.MeshPhongMaterial({
  color: 0xcc00cc,      // Darker magenta
  emissive: 0x220022,
  shininess: 50,
  specular: 0x550055,
  flatShading: false,
});


// --- Environment Materials & Colors ---
export const gridColor = new THREE.Color(0x00ffff);         // Main grid lines (cyan)
export const gridCenterLineColor = new THREE.Color(0x007777); // Center lines (darker cyan)

// Background Color for the scene (used in engine.ts)
export const sceneBackgroundColor = new THREE.Color(0x00001a); // Very dark blue, almost black


// --- Utility to potentially change material properties dynamically ---
// (Placeholder - more complex logic might be needed based on use case)
export function setMaterialEmissive(material: THREE.Material, color: THREE.ColorRepresentation, intensity: number = 1) {
    if ((material as THREE.MeshPhongMaterial).isMeshPhongMaterial) {
        const phongMaterial = material as THREE.MeshPhongMaterial;
        phongMaterial.emissive.set(color);
        // Phong doesn't have emissiveIntensity directly.
        // We'd need to multiply the emissive color by intensity,
        // but set() above already incorporates intensity if Color object is pre-multiplied.
        // For simplicity, we assume 'color' is the final emissive color.
        // If 'intensity' is meant to scale, the color object itself should be scaled before calling.
    }
    material.needsUpdate = true;
}


// --- Existing code below ---

/**
 * Creates a glowing trail material for the player.
 */
export function createTrailMaterial(): THREE.LineBasicMaterial {
  return new THREE.LineBasicMaterial({
    color: 0x00ffff,
    linewidth: 2,
    transparent: true,
    opacity: 0.75
  });
}

/**
 * Creates a mesh from a given geometry and trail material.
 */
export function createTrailMesh(geometry: THREE.BufferGeometry): THREE.Line {
  const material = createTrailMaterial();
  return new THREE.Line(geometry, material);
}

/**
 * Creates a translucent material to represent claimed areas.
 */
export function createClaimedAreaMaterial(): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: 0x00ff9f,
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide
  });
}