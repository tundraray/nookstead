/**
 * GMS-format autotile engine (48 frames per terrain type).
 *
 * Each terrain spritesheet is 12 cols × 4 rows = 48 frames.
 * Frame 0 = empty (transparent).
 *
 * Frames 1-16: all 4 edges present, corners descending 0xF → 0x0.
 *   Frame 1 = solid (all corners), Frame 16 = cross (no corners).
 * Frames 17-47: fewer edges, corridors, single edges, isolated.
 *
 * Internally we use a two-level key: (edgeMask 4-bit, cornerMask 4-bit).
 *   Edges:   N=0x1  E=0x2  S=0x4  W=0x8
 *   Corners: NW=0x1 NE=0x2 SE=0x4 SW=0x8
 *   Corners only count when both adjacent edges are present.
 */

// --- 8-bit neighbor flags ---
export const N = 1;
export const NE = 2;
export const E = 4;
export const SE = 8;
export const S = 16;
export const SW = 32;
export const W = 64;
export const NW = 128;

// --- Edge/corner split ---
export function splitNeighbors(raw: number) {
  const hasN = !!(raw & N);
  const hasE = !!(raw & E);
  const hasS = !!(raw & S);
  const hasW = !!(raw & W);

  let edges = 0;
  if (hasN) edges |= 0x1;
  if (hasE) edges |= 0x2;
  if (hasS) edges |= 0x4;
  if (hasW) edges |= 0x8;

  let corners = 0;
  if (hasN && hasW && (raw & NW)) corners |= 0x1;
  if (hasN && hasE && (raw & NE)) corners |= 0x2;
  if (hasS && hasE && (raw & SE)) corners |= 0x4;
  if (hasS && hasW && (raw & SW)) corners |= 0x8;

  return { edges, corners };
}

/**
 * Lookup: (edges << 4 | corners) → frame index.
 *
 * Frames 1-16: all 4 edges, corners = 0xF down to 0x0.
 * Frames 17-47: three/two/one/zero edges with corner variants.
 */
const LOOKUP: Record<number, number> = {
  // --- All 4 edges (frames 1-16), corners descending ---
  0xFF: 1,   // solid (all corners)
  0xFE: 2,   // missing NW
  0xFD: 3,   // missing NE
  0xFC: 4,   // missing NW+NE
  0xFB: 5,   // missing SE
  0xFA: 6,   // missing NW+SE
  0xF9: 7,   // missing NE+SE → NW+SW present
  0xF8: 8,   // missing NW+NE+SE → only SW
  0xF7: 9,   // missing SW
  0xF6: 10,  // missing NW+SW → NE+SE present
  0xF5: 11,  // missing NE+SW → NW+SE present
  0xF4: 12,  // missing NW+NE+SW → only SE
  0xF3: 13,  // missing SE+SW → NW+NE present
  0xF2: 14,  // missing NW+SE+SW → only NE
  0xF1: 15,  // missing NE+SE+SW → only NW
  0xF0: 16,  // no corners (cross)

  // --- Three edges (frames 17-28) ---
  // N+E+S
  0x70: 17,  // no corners
  0x72: 18,  // NE
  0x74: 19,  // SE
  0x76: 20,  // NE+SE

  // E+S+W
  0xE0: 21,  // no corners
  0xE4: 22,  // SE
  0xE8: 23,  // SW
  0xEC: 24,  // SE+SW

  // N+S+W
  0xD0: 25,  // no corners
  0xD1: 26,  // NW
  0xD8: 27,  // SW
  0xD9: 28,  // NW+SW

  // N+E+W
  0xB0: 29,  // no corners
  0xB1: 30,  // NW
  0xB2: 31,  // NE
  0xB3: 32,  // NW+NE

  // --- Corridors (frames 33-34) ---
  0x50: 33,  // N+S │
  0xA0: 34,  // E+W ─

  // --- Two adjacent edges (frames 35-42) ---
  0x30: 35,  // N+E
  0x32: 36,  // N+E+ne
  0x60: 37,  // E+S
  0x64: 38,  // E+S+se
  0xC0: 39,  // S+W
  0xC8: 40,  // S+W+sw
  0x90: 41,  // N+W
  0x91: 42,  // N+W+nw

  // --- Single edge (frames 43-46) ---
  0x10: 43,  // N only
  0x20: 44,  // E only
  0x40: 45,  // S only
  0x80: 46,  // W only

  // --- Isolated (frame 47) ---
  0x00: 47,
};

/**
 * Get the autotile frame index (0-47) for a given 8-bit neighbor mask.
 */
export function getFrame(neighbors: number): number {
  const { edges, corners } = splitNeighbors(neighbors);
  const key = (edges << 4) | corners;

  if (key in LOOKUP) return LOOKUP[key];

  // Fallback: try matching edges only (corners=0)
  const edgeKey = edges << 4;
  if (edgeKey in LOOKUP) return LOOKUP[edgeKey];

  // Last resort
  return ISOLATED_FRAME;
}

/** Total frames per autotile terrain type. */
export const FRAMES_PER_TERRAIN = 48;

/** The "solid center" frame (all neighbors present). */
export const SOLID_FRAME = 1;

/** The "isolated" frame (no neighbors). */
export const ISOLATED_FRAME = 47;

/** The "empty" frame (no terrain here). */
export const EMPTY_FRAME = 0;

/** Reverse lookup: frame index → bitmask key (edges<<4|corners). */
export const FRAME_TO_BITMASK: Record<number, number> = {};
for (const [key, frame] of Object.entries(LOOKUP)) {
  FRAME_TO_BITMASK[frame] = Number(key);
}

/** Human-readable name for each frame (notch = inner corner cut). */
export const FRAME_NAMES: Record<number, string> = {
  0:  'empty',
  // All 4 edges, named by which corners are cut
  1:  'solid',
  2:  '↖',         // NW notch
  3:  '↗',         // NE notch
  4:  '↖↗',       // top 2 notches
  5:  '↘',         // SE notch
  6:  '↖↘',       // diagonal ╲
  7:  '↗↘',       // right 2
  8:  '↗↘↖',     // only SW ok
  9:  '↙',         // SW notch
  10: '↖↙',       // left 2
  11: '↗↙',       // diagonal ╱
  12: '↖↗↙',     // only SE ok
  13: '↘↙',       // bottom 2
  14: '↖↘↙',     // only NE ok
  15: '↗↘↙',     // only NW ok
  16: '↖↗↘↙',   // all 4 notches
  // Three edges (open side + corner variants)
  17: 'open W',
  18: 'open W ↗',
  19: 'open W ↘',
  20: 'open W ↗↘',
  21: 'open N',
  22: 'open N ↘',
  23: 'open N ↙',
  24: 'open N ↘↙',
  25: 'open E',
  26: 'open E ↖',
  27: 'open E ↙',
  28: 'open E ↖↙',
  29: 'open S',
  30: 'open S ↖',
  31: 'open S ↗',
  32: 'open S ↖↗',
  // Corridors
  33: '│ N-S',
  34: '─ E-W',
  // Two adjacent edges (outer corners)
  35: '⌜ S→E wide',
  36: '⌜ S→E',
  37: '⌝ S→W wide',
  38: '⌝ S→W',
  39: '⌟ N→W wide',
  40: '⌟ N→W',
  41: '⌞ N→E wide',
  42: '⌞ N→E',
  // Single edge (peninsula)
  43: '╷ dead S',   // open to N, dead end at bottom
  44: '╶ dead E',   // open to ?, dead end right
  45: '╵ dead N',   // open to S, dead end at top
  46: '╴ dead W',   // open to ?, dead end left
  // Isolated
  47: '•',
};
