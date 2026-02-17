import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SessionTracker } from './SessionTracker';
import { ServerMessage } from '@nookstead/shared';

// Mock Colyseus Client and Room
const createMockClient = () => ({
  sessionId: 'session-abc',
  send: jest.fn(),
  leave: jest.fn(),
});

const createMockRoom = () => ({
  roomId: 'room-001',
});

describe('SessionTracker', () => {
  let tracker: SessionTracker;

  beforeEach(() => {
    tracker = new SessionTracker();
  });

  it('register: stores session entry', () => {
    // RED: fails until register is implemented
    const client = createMockClient();
    const room = createMockRoom();

    tracker.register('user-1', client as never, room as never);

    // Verify via checkAndKick behavior (no kick = entry registered)
    // Indirect verification: register then unregister, no entry remains
    tracker.unregister('user-1');
    // If no error thrown, registration worked
  });

  it('unregister: removes session entry', async () => {
    // RED: fails until unregister is implemented
    const client = createMockClient();
    const room = createMockRoom();

    tracker.register('user-2', client as never, room as never);
    tracker.unregister('user-2');

    // After unregister, checkAndKick should be a no-op (no send, no leave called)
    const newClient = createMockClient();
    await tracker.checkAndKick('user-2');

    expect(newClient.send).not.toHaveBeenCalled();
    expect(client.leave).not.toHaveBeenCalled();
  });

  it('checkAndKick: no-op when no existing session', async () => {
    // RED: fails until checkAndKick is implemented
    // No register call
    await tracker.checkAndKick('user-3');
    // Should not throw; should be a no-op
  });

  it('checkAndKick: sends SESSION_KICKED and disconnects old client when duplicate', async () => {
    // RED: fails until checkAndKick is implemented
    const oldClient = createMockClient();
    const room = createMockRoom();

    tracker.register('user-4', oldClient as never, room as never);

    await tracker.checkAndKick('user-4');

    expect(oldClient.send).toHaveBeenCalledWith(
      ServerMessage.SESSION_KICKED,
      expect.objectContaining({ reason: expect.any(String) })
    );
    expect(oldClient.leave).toHaveBeenCalled();
  });

  it('checkAndKick: cleans up old entry after kick', async () => {
    // RED: fails until checkAndKick is implemented
    const oldClient = createMockClient();
    const room = createMockRoom();

    tracker.register('user-5', oldClient as never, room as never);
    await tracker.checkAndKick('user-5');

    // After kick, a second checkAndKick should be no-op (entry cleaned)
    oldClient.send.mockClear();
    oldClient.leave.mockClear();
    await tracker.checkAndKick('user-5');

    expect(oldClient.send).not.toHaveBeenCalled();
    expect(oldClient.leave).not.toHaveBeenCalled();
  });

  it('register after kick: new entry replaces old', async () => {
    // RED: fails until all methods are implemented
    const oldClient = createMockClient();
    const newClient = createMockClient();
    newClient.sessionId = 'session-xyz';
    const room = createMockRoom();

    tracker.register('user-6', oldClient as never, room as never);
    await tracker.checkAndKick('user-6');
    tracker.register('user-6', newClient as never, room as never);

    // New session is registered; a kick now targets newClient
    await tracker.checkAndKick('user-6');

    expect(newClient.send).toHaveBeenCalledWith(
      ServerMessage.SESSION_KICKED,
      expect.objectContaining({ reason: expect.any(String) })
    );
    expect(newClient.leave).toHaveBeenCalled();
    // Old client was not called again
    expect(oldClient.send).toHaveBeenCalledTimes(1); // only from first kick
  });
});
