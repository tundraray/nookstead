/**
 * Unit tests for the dialogue movement-lock system.
 *
 * Verifies:
 * 1. isMovementLocked() defaults to false
 * 2. Lock event sets flag to true
 * 3. Unlock event sets flag to false
 * 4. setupMovementLock resets flag to false
 * 5. teardownMovementLock removes listeners and resets flag
 * 6. After teardown, events no longer affect the flag
 */

// Mock the EventBus (Phaser dependency) before importing the module under test
const mockOn = jest.fn();
const mockOff = jest.fn();

jest.mock('../EventBus', () => ({
  EventBus: {
    on: (...args: unknown[]) => mockOn(...args),
    off: (...args: unknown[]) => mockOff(...args),
  },
}));

import {
  isMovementLocked,
  setupMovementLock,
  teardownMovementLock,
} from './dialogue-lock';

describe('dialogue-lock', () => {
  // Capture the listener callbacks registered via EventBus.on
  let lockCallback: (() => void) | undefined;
  let unlockCallback: (() => void) | undefined;

  beforeEach(() => {
    mockOn.mockReset();
    mockOff.mockReset();
    lockCallback = undefined;
    unlockCallback = undefined;

    // Capture callbacks when setupMovementLock registers listeners
    mockOn.mockImplementation((event: string, cb: () => void) => {
      if (event === 'dialogue:lock-movement') lockCallback = cb;
      if (event === 'dialogue:unlock-movement') unlockCallback = cb;
    });

    setupMovementLock();
  });

  afterEach(() => {
    teardownMovementLock();
  });

  it('should default to unlocked after setup', () => {
    expect(isMovementLocked()).toBe(false);
  });

  it('should register two EventBus listeners on setup', () => {
    expect(mockOn).toHaveBeenCalledWith(
      'dialogue:lock-movement',
      expect.any(Function),
    );
    expect(mockOn).toHaveBeenCalledWith(
      'dialogue:unlock-movement',
      expect.any(Function),
    );
  });

  it('should set locked to true when lock event fires', () => {
    expect(lockCallback).toBeDefined();
    lockCallback!();
    expect(isMovementLocked()).toBe(true);
  });

  it('should set locked to false when unlock event fires', () => {
    lockCallback!();
    expect(isMovementLocked()).toBe(true);

    unlockCallback!();
    expect(isMovementLocked()).toBe(false);
  });

  it('should reset flag to false on setupMovementLock even if previously locked', () => {
    lockCallback!();
    expect(isMovementLocked()).toBe(true);

    // Re-setup should reset
    setupMovementLock();
    expect(isMovementLocked()).toBe(false);
  });

  it('should remove listeners and reset flag on teardownMovementLock', () => {
    lockCallback!();
    expect(isMovementLocked()).toBe(true);

    teardownMovementLock();

    expect(isMovementLocked()).toBe(false);
    expect(mockOff).toHaveBeenCalledWith(
      'dialogue:lock-movement',
      expect.any(Function),
    );
    expect(mockOff).toHaveBeenCalledWith(
      'dialogue:unlock-movement',
      expect.any(Function),
    );
  });
});
