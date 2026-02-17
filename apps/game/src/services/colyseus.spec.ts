/**
 * Integration tests for the Colyseus client connection service.
 *
 * Tests verify:
 * 1. joinChunkRoom connects to the correct room type (CHUNK_ROOM_NAME)
 * 2. handleChunkTransition leaves the old room and joins a new one
 * 3. onSessionKicked callback fires when SESSION_KICKED message is received
 *
 * Mocking strategy:
 * - @colyseus/sdk is mocked with a Client class whose joinOrCreate returns a
 *   mock room with onMessage / leave stubs.
 * - global.fetch is mocked to simulate the /api/colyseus-token endpoint.
 * - jest.resetModules() is used in beforeEach to reset module-level state
 *   (client, currentRoom, sessionKickedCallback) between tests.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { CHUNK_ROOM_NAME, ServerMessage } from '@nookstead/shared';

// ---------------------------------------------------------------------------
// Mock scaffolding (file-scoped so the jest.mock factory can reference them)
// ---------------------------------------------------------------------------

/** Stores message handlers registered via room.onMessage(type, handler) */
let messageHandlers: Record<string, (...args: any[]) => void>;

/** Mock for Room.leave */
const mockLeave = jest.fn<Promise<void>, [boolean?]>();

/** Mock for Client.joinOrCreate */
const mockJoinOrCreate = jest.fn<Promise<any>, [string, Record<string, unknown>?]>();

/**
 * Create a fresh mock room object. Each call returns a new instance so that
 * the first and second rooms joined in a test are distinguishable.
 */
function createMockRoom(id = 'room-default') {
  const handlers: Record<string, (...args: any[]) => void> = {};
  return {
    id,
    sessionId: `session-${id}`,
    onMessage: jest.fn((type: string, handler: (...args: any[]) => void) => {
      handlers[type] = handler;
    }),
    leave: mockLeave,
    /** Expose the handler map so tests can trigger messages. */
    __handlers: handlers,
  };
}

// ---------------------------------------------------------------------------
// Module mock: @colyseus/sdk
// ---------------------------------------------------------------------------
jest.mock('@colyseus/sdk', () => ({
  Client: jest.fn().mockImplementation(() => ({
    joinOrCreate: (...args: any[]) => mockJoinOrCreate(...args),
  })),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Colyseus client service', () => {
  /** Dynamically imported module (fresh per test via resetModules). */
  let service: typeof import('./colyseus');

  beforeEach(async () => {
    // Reset the module registry so module-level state (client, currentRoom,
    // sessionKickedCallback) starts fresh for every test.
    jest.resetModules();

    // Clear all mock call history and implementations
    mockJoinOrCreate.mockReset();
    mockLeave.mockReset();
    messageHandlers = {};

    // Default mock room returned by joinOrCreate
    const defaultRoom = createMockRoom('room-1');
    messageHandlers = defaultRoom.__handlers;
    mockJoinOrCreate.mockResolvedValue(defaultRoom);
    mockLeave.mockResolvedValue(undefined);

    // Mock global.fetch to simulate /api/colyseus-token
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ token: 'test-session-token' }),
    }) as any;

    // Dynamically import the module to get fresh state
    service = await import('./colyseus');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Test 1: joinChunkRoom connects to the correct room type
  // -------------------------------------------------------------------------
  it('joinChunkRoom: connects to chunk_room type', async () => {
    const room = await service.joinChunkRoom();

    // Verify joinOrCreate was called with the CHUNK_ROOM_NAME constant
    expect(mockJoinOrCreate).toHaveBeenCalledTimes(1);
    expect(mockJoinOrCreate).toHaveBeenCalledWith(
      CHUNK_ROOM_NAME,
      expect.objectContaining({ token: 'test-session-token' })
    );

    // Verify the room was returned
    expect(room).toBeDefined();
    expect(room.id).toBe('room-1');
  });

  // -------------------------------------------------------------------------
  // Test 2: handleChunkTransition leaves the old room and joins a new one
  // -------------------------------------------------------------------------
  it('handleChunkTransition: leaves old room, joins new room', async () => {
    // First join to establish currentRoom
    await service.joinChunkRoom();
    expect(mockJoinOrCreate).toHaveBeenCalledTimes(1);

    // Setup: second call to joinOrCreate returns a different room
    const newRoom = createMockRoom('room-2');
    mockJoinOrCreate.mockResolvedValueOnce(newRoom);

    // Act: transition to a new chunk
    const result = await service.handleChunkTransition('new-chunk-id');

    // Assert: old room was left without consent (false = server may attempt reconnect)
    expect(mockLeave).toHaveBeenCalledTimes(1);
    expect(mockLeave).toHaveBeenCalledWith(false);

    // Assert: joinOrCreate was called again (total 2 calls) for the new chunk
    expect(mockJoinOrCreate).toHaveBeenCalledTimes(2);
    expect(mockJoinOrCreate).toHaveBeenLastCalledWith(
      CHUNK_ROOM_NAME,
      expect.objectContaining({
        token: 'test-session-token',
        chunkId: 'new-chunk-id',
      })
    );

    // Assert: returned room is the new room
    expect(result.id).toBe('room-2');
  });

  // -------------------------------------------------------------------------
  // Test 3: onSessionKicked callback fires on SESSION_KICKED message
  // -------------------------------------------------------------------------
  it('onSessionKicked: callback fires on SESSION_KICKED message', async () => {
    const kickedCallback = jest.fn();

    // Register the session-kicked callback BEFORE joining
    service.onSessionKicked(kickedCallback);

    // Join to register message handlers on the room
    await service.joinChunkRoom();

    // Verify onMessage was registered for SESSION_KICKED
    expect(messageHandlers[ServerMessage.SESSION_KICKED]).toBeDefined();

    // Simulate server sending SESSION_KICKED message
    messageHandlers[ServerMessage.SESSION_KICKED]();

    // Assert the callback was invoked
    expect(kickedCallback).toHaveBeenCalledTimes(1);
  });
});
