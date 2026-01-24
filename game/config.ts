/**
 * Centralized game configuration constants
 * All magic numbers and game parameters should be defined here
 */

// =============================================================================
// GAME GRID
// =============================================================================

/** The boundary limit for the game grid (extends from -gridLimit to +gridLimit) */
export const GRID_LIMIT = 14;

/** Total playable area of the game grid */
export const TOTAL_GAME_AREA = (2 * GRID_LIMIT) * (2 * GRID_LIMIT);

// =============================================================================
// PLAYER
// =============================================================================

/** Base movement speed for the player */
export const BASE_PLAYER_SPEED = 0.25;

/** Size of the player cube (width/height/depth) */
export const PLAYER_SIZE = 2.0;

/** Default player color (green) */
export const PLAYER_COLOR = 0x00ff00;

// =============================================================================
// QIX ENEMY
// =============================================================================

/** Qix line color (magenta) */
export const QIX_COLOR = 0xff00ff;

/** Qix movement speed */
export const QIX_SPEED = 0.1;

/** Number of points/segments in the Qix line */
export const QIX_NUM_SEGMENTS = 5;

/** Length of each Qix body segment */
export const QIX_SEGMENT_LENGTH = 0.8;

/** Animation speed for Qix body undulation */
export const QIX_ANIMATION_SPEED = 0.1;

// =============================================================================
// SPARX ENEMY
// =============================================================================

/** Sparx enemy color (yellow) */
export const SPARX_COLOR = 0xffff00;

/** Fuse mode color (red) */
export const FUSE_COLOR = 0xff0000;

/** Sparx patrol speed on boundary */
export const SPARX_SPEED = 0.05;

/** Speed multiplier when Sparx is in fuse mode */
export const FUSE_SPEED_MULTIPLIER = 1.5;

/** Size of the Sparx cube */
export const SPARX_SIZE = 0.5;

// =============================================================================
// POWER-UPS
// =============================================================================

/** Maximum number of power-ups allowed on the board at once */
export const MAX_POWERUPS_ON_BOARD = 2;

/** Time interval (seconds) between power-up spawn attempts */
export const POWERUP_SPAWN_INTERVAL = 15.0;

/** Size of power-up objects */
export const POWERUP_SIZE = 0.7;

/** Margin from edges when spawning power-ups */
export const POWERUP_SPAWN_MARGIN = 2.0;

// =============================================================================
// GAME MECHANICS
// =============================================================================

/** Delay (seconds) before fuse activates on an open trail */
export const FUSE_ACTIVATION_DELAY = 3.0;

/** Tolerance value for floating-point comparisons */
export const EPSILON = 0.1;

/** Margin used when pushing Qix away from new confinement boundary */
export const QIX_PUSH_MARGIN = 0.2;

/** Starting number of lives */
export const INITIAL_LIVES = 3;

/** Starting score */
export const INITIAL_SCORE = 0;

// =============================================================================
// COLLISION
// =============================================================================

/** Collision threshold for player-sparx (sum of half-sizes) */
export const PLAYER_SPARX_COLLISION_THRESHOLD = (PLAYER_SIZE / 2) + (SPARX_SIZE / 2);

/** Boundary detection tolerance */
export const BOUNDARY_TOLERANCE = 0.1;

// =============================================================================
// STORAGE KEYS
// =============================================================================

/** LocalStorage key for high score */
export const STORAGE_KEY_HIGH_SCORE = 'qixCloneGame_highScore';

/** LocalStorage key for max area captured */
export const STORAGE_KEY_MAX_AREA = 'qixCloneGame_maxAreaCaptured';

// =============================================================================
// VISUAL
// =============================================================================

/** Edge material color for wireframe highlights */
export const EDGE_MATERIAL_COLOR = 0xffffff;

/** Edge material opacity */
export const EDGE_MATERIAL_OPACITY = 0.5;

/** Grid line color (cyan) */
export const GRID_COLOR = 0x00ffff;

/** Scene background color (very dark blue) */
export const SCENE_BACKGROUND_COLOR = 0x000000;
