/**
 * Movement lock system for dialogue.
 *
 * Provides a module-level flag that gates player movement input while a
 * dialogue session is active. The Game scene manages the listener lifecycle
 * via {@link setupMovementLock} / {@link teardownMovementLock}; states and
 * handlers read the flag via {@link isMovementLocked}.
 *
 * EventBus events consumed:
 * - `dialogue:lock-movement`   -- emitted by HUD when dialogue opens
 * - `dialogue:unlock-movement` -- emitted by HUD when dialogue closes
 */

import { EventBus } from '../EventBus';

/** Module-level flag -- true while a dialogue session is active. */
let movementLocked = false;

/** Returns true when player movement should be suppressed. */
export function isMovementLocked(): boolean {
  return movementLocked;
}

// ---------------------------------------------------------------------------
// Listener callbacks (kept as named references for clean removal)
// ---------------------------------------------------------------------------

function onLock(): void {
  movementLocked = true;
}

function onUnlock(): void {
  movementLocked = false;
}

// ---------------------------------------------------------------------------
// Lifecycle -- called by Game scene create / shutdown
// ---------------------------------------------------------------------------

/**
 * Register EventBus listeners that set/clear the movement lock flag.
 * Call once during Game scene `create()`.
 */
export function setupMovementLock(): void {
  movementLocked = false;
  EventBus.on('dialogue:lock-movement', onLock);
  EventBus.on('dialogue:unlock-movement', onUnlock);
}

/**
 * Remove EventBus listeners and reset the flag.
 * Call during Game scene `shutdown()` / `destroy()`.
 */
export function teardownMovementLock(): void {
  EventBus.off('dialogue:lock-movement', onLock);
  EventBus.off('dialogue:unlock-movement', onUnlock);
  movementLocked = false;
}
