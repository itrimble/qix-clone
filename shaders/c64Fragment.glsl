uniform sampler2D tDiffuse; // Scene texture
uniform vec2 resolution;    // Screen resolution (e.g., 1024, 768)
uniform float pixelSize;    // Desired size of the retro pixels (e.g., 8.0 for 8x8 pixels)

varying vec2 vUv;

// C64 Color Palette (Normalized RGB: 0.0 - 1.0)
// Based on a common VICE palette
const int PALETTE_SIZE = 16;
vec3 c64Palette[PALETTE_SIZE];

void initializePalette() {
    c64Palette[0] = vec3(0.0, 0.0, 0.0);         // Black
    c64Palette[1] = vec3(1.0, 1.0, 1.0);         // White
    c64Palette[2] = vec3(136.0/255.0, 0.0, 0.0);       // Red
    c64Palette[3] = vec3(170.0/255.0, 1.0, 238.0/255.0); // Cyan
    c64Palette[4] = vec3(204.0/255.0, 68.0/255.0, 204.0/255.0); // Purple
    c64Palette[5] = vec3(0.0, 204.0/255.0, 85.0/255.0);  // Green
    c64Palette[6] = vec3(0.0, 0.0, 170.0/255.0);       // Blue
    c64Palette[7] = vec3(238.0/255.0, 238.0/255.0, 119.0/255.0); // Yellow
    c64Palette[8] = vec3(221.0/255.0, 136.0/255.0, 85.0/255.0); // Orange
    c64Palette[9] = vec3(102.0/255.0, 68.0/255.0, 0.0);        // Brown
    c64Palette[10] = vec3(255.0/255.0, 119.0/255.0, 119.0/255.0); // Light Red
    c64Palette[11] = vec3(51.0/255.0, 51.0/255.0, 51.0/255.0);  // Dark Grey
    c64Palette[12] = vec3(119.0/255.0, 119.0/255.0, 119.0/255.0); // Grey 2
    c64Palette[13] = vec3(170.0/255.0, 255.0/255.0, 102.0/255.0); // Light Green
    c64Palette[14] = vec3(0.0, 136.0/255.0, 255.0/255.0); // Light Blue
    c64Palette[15] = vec3(187.0/255.0, 187.0/255.0, 187.0/255.0); // Light Grey
}

// Function to find the closest color in the palette
vec3 quantizeColor(vec3 color) {
    float minDistance = 10000.0; // Large initial distance
    vec3 closestColor = c64Palette[0];

    for (int i = 0; i < PALETTE_SIZE; i++) {
        float dist = distance(color, c64Palette[i]);
        if (dist < minDistance) {
            minDistance = dist;
            closestColor = c64Palette[i];
        }
    }
    return closestColor;
}

void main() {
    initializePalette(); // Initialize the palette colors

    // Pixelation
    vec2 effectiveResolution = resolution / pixelSize;
    vec2 pixelatedUV = floor(vUv * effectiveResolution) / effectiveResolution;
    pixelatedUV += (0.5 / effectiveResolution); // Center of the retro pixel

    vec4 originalColor = texture2D(tDiffuse, pixelatedUV);

    // Color Quantization
    vec3 quantizedColor = quantizeColor(originalColor.rgb);

    gl_FragColor = vec4(quantizedColor, originalColor.a);
}
