export const FRAME_SIZE = 16;   // actual pixel size in spritesheet PNGs
export const TILE_SIZE = 16;

// --- Character ---
export const CHARACTER_FRAME_HEIGHT = 32; // character sprites are 16x32 (1 tile wide, 2 tiles tall)
export const PLAYER_SPEED = 100;          // pixels per second (GDD 7.7)
export const ANIMATION_FPS = 8;           // animation frame rate (GDD 7.7)

// --- Map generation ---
export const MAP_WIDTH = 64;
export const MAP_HEIGHT = 64;

// --- Layer depth ordering ---
// Terrain RenderTexture: depth 0 (Phaser default)
// Fence RenderTexture: depth 0.5 (above terrain, below hover highlight)
// Hover highlight: depth 1
// Player/NPC sprites: depth 2
export const FENCE_LAYER_DEPTH = 0.5;


// --- Player rendering ---
export const PLAYER_DEPTH = 2;
export const CLICK_THRESHOLD = 8;
