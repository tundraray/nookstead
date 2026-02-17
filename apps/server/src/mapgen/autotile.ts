/**
 * Blob-47 autotile engine.
 *
 * Standard 8-neighbor bitmask with diagonal gating:
 *   NW(128) N(1)  NE(2)
 *   W(64)   cell  E(4)
 *   SW(32)  S(16) SE(8)
 *
 * Diagonals count only when both adjacent cardinals are present.
 * This produces exactly 47 valid mask configurations (from 256 possible).
 *
 * Each terrain spritesheet is 12 cols x 4 rows = 48 frames.
 * Frame 0 = empty (transparent), frames 1-47 = autotile variants.
 *
 * Tileset order: most-connected first (solid = frame 1) to
 * least-connected last (isolated = frame 47).
 */

// --- 8-bit neighbor flags (standard blob weights, clockwise from N) ---
export const N = 1;
export const NE = 2;
export const E = 4;
export const SE = 8;
export const S = 16;
export const SW = 32;
export const W = 64;
export const NW = 128;

/** Total frames per autotile terrain spritesheet. */
export const FRAMES_PER_TERRAIN = 48;

/** The "solid center" frame (all neighbors present). */
export const SOLID_FRAME = 1;

/** The "isolated" frame (no neighbors). */
export const ISOLATED_FRAME = 47;

/** The "empty" frame (no terrain in this cell). */
export const EMPTY_FRAME = 0;

/**
 * The 47 valid blob masks in ascending order.
 * A mask is valid when every set diagonal bit has both adjacent cardinals set.
 */
const VALID_BLOB47_MASKS: readonly number[] = [
  0, 1, 4, 5, 7,
  16, 17, 20, 21, 23,
  28, 29, 31,
  64, 65, 68, 69, 71,
  80, 81, 84, 85, 87,
  92, 93, 95,
  112, 113, 116, 117, 119,
  124, 125, 127,
  193, 197, 199,
  209, 213, 215,
  221, 223,
  241, 245, 247, 253, 255,
];

/**
 * Direct lookup table: gated mask (0-255) -> frame index (0-47).
 * Invalid/unset entries default to ISOLATED_FRAME.
 * Built once at module load.
 */
const FRAME_TABLE: readonly number[] = buildFrameTable();

function buildFrameTable(): number[] {
  const table = new Array<number>(256).fill(ISOLATED_FRAME);

  // Tileset mapping: gated mask -> frame index
  // Order: most-connected (solid) at frame 1, least-connected (isolated) at frame 47
  //
  // Verified against tileset PNGs frame-by-frame.

  // --- Center tiles: all 4 cardinals present, corner variations (1-16) ---
  // Note: tileset uses top-first visual order (NW/NE absent before SW/SE absent)
  table[255] = 1;     // solid (all corners)
  table[127] = 2;     // SE+SW+NE (missing NW)
  table[253] = 3;     // NW+SE+SW (missing NE)
  table[125] = 4;     // SE+SW (missing NW,NE)
  table[247] = 5;     // NW+NE+SW (missing SE)
  table[119] = 6;     // NE+SW (missing NW,SE)
  table[245] = 7;     // NW+SW (missing NE,SE)
  table[117] = 8;     // SW only (missing NW,NE,SE)
  table[223] = 9;     // NW+NE+SE (missing SW)
  table[95] = 10;     // NE+SE (missing NW,SW)
  table[221] = 11;    // NW+SE (missing NE,SW)
  table[93] = 12;     // SE only (missing NW,NE,SW)
  table[215] = 13;    // NW+NE (missing SE,SW)
  table[87] = 14;     // NE only (missing NW,SE,SW)
  table[213] = 15;    // NW only (missing NE,SE,SW)
  table[85] = 16;     // cross (no corners)

  // --- T-junction open W: N+E+S present, W absent (17-20) ---
  table[31] = 17;     // +NE+SE (both corners)
  table[29] = 18;     // +SE (NE absent)
  table[23] = 19;     // +NE (SE absent)
  table[21] = 20;     // bare (no corners)

  // --- T-junction open N: E+S+W present, N absent (21-24) ---
  table[124] = 21;    // +SE+SW (both corners)
  table[116] = 22;    // +SW (SE absent)
  table[92] = 23;     // +SE (SW absent)
  table[84] = 24;     // bare (no corners)

  // --- T-junction open E: N+S+W present, E absent (25-28) ---
  table[241] = 25;    // +NW+SW (both corners)
  table[113] = 26;    // +SW (NW absent)
  table[209] = 27;    // +NW (SW absent)
  table[81] = 28;     // bare (no corners)

  // --- T-junction open S: N+E+W present, S absent (29-32) ---
  table[199] = 29;    // +NW+NE (both corners)
  table[71] = 30;     // +NE (NW absent)
  table[197] = 31;    // +NW (NE absent)
  table[69] = 32;     // bare (no corners)

  // --- Corridors (33-34) ---
  table[17] = 33;     // vertical N+S
  table[68] = 34;     // horizontal E+W

  // --- L-corner E+S (35-36) ---
  table[28] = 35;     // filled (E+SE+S)
  table[20] = 36;     // bare (E+S)

  // --- L-corner S+W (37-38) ---
  table[112] = 37;    // filled (S+SW+W)
  table[80] = 38;     // bare (S+W)

  // --- L-corner N+W (39-40) ---
  table[193] = 39;    // filled (N+NW+W)
  table[65] = 40;     // bare (N+W)

  // --- L-corner N+E (41-42) ---
  table[7] = 41;      // filled (N+NE+E)
  table[5] = 42;      // bare (N+E)

  // --- Dead-ends (43-46) ---
  table[16] = 43;     // S only
  table[4] = 44;      // E only
  table[1] = 45;      // N only
  table[64] = 46;     // W only

  // --- Isolated (47) ---
  table[0] = 47;      // no neighbors

  return table;
}

/**
 * Apply diagonal gating to a raw 8-bit neighbor mask.
 * Clears diagonal bits where both adjacent cardinals are not present.
 */
function gateDiagonals(mask: number): number {
  const hasN = !!(mask & N);
  const hasE = !!(mask & E);
  const hasS = !!(mask & S);
  const hasW = !!(mask & W);

  let gated = mask & (N | E | S | W); // keep cardinals

  if (hasN && hasE && (mask & NE)) gated |= NE;
  if (hasS && hasE && (mask & SE)) gated |= SE;
  if (hasS && hasW && (mask & SW)) gated |= SW;
  if (hasN && hasW && (mask & NW)) gated |= NW;

  return gated;
}

/**
 * Get the autotile frame index (0-47) for a given 8-bit neighbor mask.
 *
 * @param neighbors - Raw 8-bit neighbor mask (diagonals NOT pre-gated).
 * @returns Frame index suitable for rendering.
 */
export function getFrame(neighbors: number): number {
  return FRAME_TABLE[gateDiagonals(neighbors)];
}

/**
 * All 47 valid blob masks, exported for testing and tooling.
 */
export { VALID_BLOB47_MASKS };
