export const FRAME_SIZE = 16;   // actual pixel size in spritesheet PNGs
export const TILE_SIZE = 16;
export const SPRITE_SIZE = 16;

export const GAME_WIDTH = 1024;
export const GAME_HEIGHT = 768;

export const CAMERA_ZOOM = 1;

// --- Character ---
export const CHARACTER_FRAME_HEIGHT = 32; // character sprites are 16x32 (1 tile wide, 2 tiles tall)
export const PLAYER_SPEED = 100;          // pixels per second (GDD 7.7)
export const ANIMATION_FPS = 8;           // animation frame rate (GDD 7.7)

// --- Map generation ---
export const MAP_WIDTH = 64;
export const MAP_HEIGHT = 64;

// Noise parameters
export const NOISE_OCTAVES = 5;
export const NOISE_LACUNARITY = 2.0;
export const NOISE_PERSISTENCE = 0.5;
export const NOISE_SCALE = 0.025;
export const ELEVATION_EXPONENT = 1.3;

// Terrain thresholds
export const DEEP_WATER_THRESHOLD = 0.12;
export const WATER_THRESHOLD = 0.18;

// Water border
export const MIN_WATER_BORDER = 5;
