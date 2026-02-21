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

// --- Player rendering ---
export const PLAYER_DEPTH = 2;
export const PLAYER_SIZE = 32;
export const PLAYER_LOCAL_COLOR = 0x2ecc71;
export const PLAYER_REMOTE_COLOR = 0x3498db;
export const PLAYER_LABEL_FONT_SIZE = 10;
export const CLICK_THRESHOLD = 8;
