import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ChunkManager } from './ChunkManager.js';
import { CHUNK_TRANSITION_COOLDOWN_MS } from '@nookstead/shared';

describe('ChunkManager', () => {
  let manager: ChunkManager;

  beforeEach(() => {
    jest.useFakeTimers();
    manager = new ChunkManager();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Room lifecycle', () => {
    it('should register and unregister rooms', () => {
      const mockRoom = { roomId: 'room-1' };

      manager.registerRoom('city:capital', mockRoom);
      expect(manager.getActiveRoomCount()).toBe(1);

      manager.unregisterRoom('city:capital');
      expect(manager.getActiveRoomCount()).toBe(0);
    });

    it('should return registered room or undefined for unregistered', () => {
      const mockRoom = { roomId: 'room-2' };

      manager.registerRoom('forest:north', mockRoom);

      const retrieved = manager.getRoom('forest:north');
      expect(retrieved).toBeDefined();
      expect(retrieved.roomId).toBe('room-2');

      const missing = manager.getRoom('nonexistent:chunk');
      expect(missing).toBeUndefined();
    });

    it('should return accurate active room count after register and unregister', () => {
      const mockRoom1 = { roomId: 'room-1' };
      const mockRoom2 = { roomId: 'room-2' };
      const mockRoom3 = { roomId: 'room-3' };

      expect(manager.getActiveRoomCount()).toBe(0);

      manager.registerRoom('city:capital', mockRoom1);
      expect(manager.getActiveRoomCount()).toBe(1);

      manager.registerRoom('forest:north', mockRoom2);
      expect(manager.getActiveRoomCount()).toBe(2);

      manager.registerRoom('beach:west', mockRoom3);
      expect(manager.getActiveRoomCount()).toBe(3);

      manager.unregisterRoom('forest:north');
      expect(manager.getActiveRoomCount()).toBe(2);
    });
  });

  describe('Boundary oscillation prevention', () => {
    it('should allow transition when no recent transition exists', () => {
      expect(manager.canTransition('player-1')).toBe(true);
    });

    it('should block transition within cooldown period', () => {
      manager.recordTransition('player-2');

      // Immediately after recording, should be blocked
      expect(manager.canTransition('player-2')).toBe(false);

      // Advance halfway through cooldown
      jest.advanceTimersByTime(CHUNK_TRANSITION_COOLDOWN_MS / 2);
      expect(manager.canTransition('player-2')).toBe(false);

      // Advance to exactly the cooldown threshold
      jest.advanceTimersByTime(CHUNK_TRANSITION_COOLDOWN_MS / 2);
      expect(manager.canTransition('player-2')).toBe(true);
    });

    it('should update last transition time when recording transition', () => {
      manager.recordTransition('player-3');
      expect(manager.canTransition('player-3')).toBe(false);

      // Advance past cooldown
      jest.advanceTimersByTime(CHUNK_TRANSITION_COOLDOWN_MS);
      expect(manager.canTransition('player-3')).toBe(true);

      // Record again - should reset the cooldown
      manager.recordTransition('player-3');
      expect(manager.canTransition('player-3')).toBe(false);

      // Must wait full cooldown again
      jest.advanceTimersByTime(CHUNK_TRANSITION_COOLDOWN_MS - 1);
      expect(manager.canTransition('player-3')).toBe(false);

      jest.advanceTimersByTime(1);
      expect(manager.canTransition('player-3')).toBe(true);
    });
  });
});
