// Re-export shim: all exports now come from @nookstead/map-lib
// This file is kept for backward compatibility. Prefer importing from @nookstead/map-lib directly.
export { applyDeltas, PaintCommand, FillCommand } from '@nookstead/map-lib';
export type { CellDelta, EditorCommand } from '@nookstead/map-lib';
