// Chunk-Based Room Architecture Integration Test - Design Doc: design-005-chunk-based-room-architecture.md
// Generated: 2026-02-17 | Budget Used: 3/3 integration, 0/2 E2E (E2E in separate file)
//
// Test Strategy:
//   - ChunkRoom is the integration point wiring World (state authority),
//     PlayerPositionService (DB persistence), ChunkRoomState (Colyseus schema),
//     and verifyNextAuthToken (auth).
//   - Mock boundaries: World, ChunkManager, colyseus Room, verifyToken, config, DB
//   - Real components: ChunkRoom itself (the system under test)
//   - Pattern: follows existing GameRoom.spec.ts jest.mock pattern

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { ServerPlayer } from '../models/Player';
import type { LoadPositionResult, SavePositionData } from '@nookstead/db';
import type { MoveResult } from '@nookstead/shared';

/* ------------------------------------------------------------------ */
/*  Captured message handlers from Room.onMessage registrations       */
/* ------------------------------------------------------------------ */
const messageHandlers = new Map<
  string,
  (client: unknown, payload: unknown) => void
>();

/* ------------------------------------------------------------------ */
/*  Module mocks (hoisted by Jest before imports)                     */
/* ------------------------------------------------------------------ */
jest.mock('colyseus', () => {
  class MockRoom {
    state: unknown;
    roomId = 'test-room-id';

    setState(state: unknown): void {
      this.state = state;
    }

    setPatchRate(_rate: number): void {
      /* no-op */
    }

    setSimulationInterval(_cb: () => void, _interval: number): void {
      /* no-op */
    }

    onMessage(
      type: string,
      handler: (client: unknown, payload: unknown) => void
    ): void {
      messageHandlers.set(type, handler);
    }
  }

  return {
    __esModule: true,
    Room: MockRoom,
  };
});

jest.mock('../config', () => ({
  __esModule: true,
  loadConfig: jest.fn().mockReturnValue({
    port: 2567,
    authSecret: 'test-secret',
    databaseUrl: 'postgres://test',
    corsOrigin: 'http://localhost:3000',
  }),
}));

jest.mock('../auth/verifyToken', () => ({
  __esModule: true,
  verifyNextAuthToken: jest.fn(),
}));

// Mock the World module - provide a fresh World-like object for each test
const mockWorld = {
  addPlayer: jest.fn<(player: ServerPlayer) => void>(),
  removePlayer: jest.fn<(playerId: string) => ServerPlayer | undefined>(),
  movePlayer: jest.fn<(playerId: string, dx: number, dy: number) => MoveResult>(),
  getPlayer: jest.fn<(playerId: string) => ServerPlayer | undefined>(),
  getPlayersInChunk: jest.fn<(chunkId: string) => ServerPlayer[]>(),
};

jest.mock('../world/World', () => ({
  __esModule: true,
  world: mockWorld,
  computeChunkId: jest.fn<(worldX: number, worldY: number) => string>().mockReturnValue('city:capital'),
}));

// Mock ChunkManager module
const mockChunkManager = {
  registerRoom: jest.fn<(chunkId: string, room: unknown) => void>(),
  unregisterRoom: jest.fn<(chunkId: string) => void>(),
  canTransition: jest.fn<(playerId: string) => boolean>().mockReturnValue(true),
  recordTransition: jest.fn<(playerId: string) => void>(),
};

jest.mock('../world/ChunkManager', () => ({
  __esModule: true,
  chunkManager: mockChunkManager,
}));

// Mock @nookstead/db
const mockLoadPosition = jest.fn<(db: unknown, userId: string) => Promise<LoadPositionResult | null>>();
const mockSavePosition = jest.fn<(db: unknown, data: SavePositionData) => Promise<void>>();
const mockLoadMap = jest.fn<(db: unknown, userId: string) => Promise<unknown>>();
const mockSaveMap = jest.fn<(db: unknown, data: unknown) => Promise<void>>();
const mockGetGameDb = jest.fn<() => unknown>().mockReturnValue({});

jest.mock('@nookstead/db', () => ({
  __esModule: true,
  savePosition: mockSavePosition,
  loadPosition: mockLoadPosition,
  loadMap: mockLoadMap,
  saveMap: mockSaveMap,
}));

jest.mock('@nookstead/db/adapters/colyseus', () => ({
  __esModule: true,
  getGameDb: mockGetGameDb,
}));

// Mock mapgen module
const mockGenerate = jest.fn<() => unknown>().mockReturnValue({
  seed: 42,
  width: 64,
  height: 64,
  grid: [[{ terrain: 'grass', elevation: 1, meta: {} }]],
  layers: [{ name: 'base', terrainKey: 'terrain', frames: [[0]] }],
  walkable: [[true]],
});
const mockCreateMapGenerator = jest.fn<() => unknown>().mockReturnValue({
  generate: mockGenerate,
});

jest.mock('../mapgen/index', () => ({
  __esModule: true,
  createMapGenerator: mockCreateMapGenerator,
}));

// Mock SessionTracker singleton
const mockSessionTracker = {
  register: jest.fn<(userId: string, client: unknown, room: unknown) => void>(),
  unregister: jest.fn<(userId: string) => void>(),
  checkAndKick: jest.fn<(userId: string) => Promise<void>>().mockResolvedValue(undefined),
};

jest.mock('../sessions', () => ({
  __esModule: true,
  sessionTracker: mockSessionTracker,
}));

/* ------------------------------------------------------------------ */
/*  Imports (resolved after mocks are applied)                        */
/* ------------------------------------------------------------------ */
import { ChunkRoom } from './ChunkRoom';
import { verifyNextAuthToken } from '../auth/verifyToken';
import type { AuthData } from '@nookstead/shared';
import { DEFAULT_SPAWN, ServerMessage, CHUNK_SIZE } from '@nookstead/shared';

/* ------------------------------------------------------------------ */
/*  Type aliases for readability                                      */
/* ------------------------------------------------------------------ */
interface MockClient {
  sessionId: string;
  send: jest.Mock;
}

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */
describe('ChunkRoom', () => {
  let room: ChunkRoom;
  let mockClient: MockClient;

  beforeEach(() => {
    messageHandlers.clear();
    jest.clearAllMocks();

    room = new ChunkRoom();
    mockClient = {
      sessionId: 'test-session-id',
      send: jest.fn(),
    };

    // Reset default mock behaviors
    mockLoadPosition.mockResolvedValue(null);
    mockSavePosition.mockResolvedValue(undefined);
    mockChunkManager.canTransition.mockReturnValue(true);
    mockLoadMap.mockResolvedValue(null);
    mockSaveMap.mockResolvedValue(undefined);
    mockGenerate.mockReturnValue({
      seed: 42,
      width: 64,
      height: 64,
      grid: [[{ terrain: 'grass', elevation: 1, meta: {} }]],
      layers: [{ name: 'base', terrainKey: 'terrain', frames: [[0]] }],
      walkable: [[true]],
    });
    mockCreateMapGenerator.mockReturnValue({ generate: mockGenerate });
    mockSessionTracker.checkAndKick.mockResolvedValue(undefined);
  });

  /* ================================================================ */
  /*  INT-1: Join Flow Integration                                    */
  /* ================================================================ */
  describe('onJoin integration', () => {
    it('AC5.1: new player with no saved position is placed at default spawn and added to World', async () => {
      // Arrange
      mockLoadPosition.mockResolvedValue(null);

      const authData: AuthData = {
        userId: 'user-new',
        email: 'new@test.com',
      };

      room.onCreate({ chunkId: 'city:capital' });

      // Act
      await room.onJoin(mockClient as never, {}, authData);

      // Verify: loadPosition was called with the db instance and userId
      expect(mockLoadPosition).toHaveBeenCalledWith({}, 'user-new');

      // Verify: World.addPlayer was called with a ServerPlayer at default spawn
      expect(mockWorld.addPlayer).toHaveBeenCalledTimes(1);
      const addedPlayer = mockWorld.addPlayer.mock.calls[0][0];
      expect(addedPlayer.worldX).toBe(DEFAULT_SPAWN.worldX);
      expect(addedPlayer.worldY).toBe(DEFAULT_SPAWN.worldY);
      expect(addedPlayer.chunkId).toBe(DEFAULT_SPAWN.chunkId);
      expect(addedPlayer.userId).toBe('user-new');
      expect(addedPlayer.id).toBe('test-session-id');

      // Verify: schema has the player with correct values
      const chunkPlayer = room.state.players.get('test-session-id');
      expect(chunkPlayer).toBeDefined();
      expect(chunkPlayer?.worldX).toBe(DEFAULT_SPAWN.worldX);
      expect(chunkPlayer?.worldY).toBe(DEFAULT_SPAWN.worldY);
      expect(chunkPlayer?.direction).toBe('down');
    });

    it('AC5.2: returning player is placed at saved position loaded from DB', async () => {
      // Arrange
      mockLoadPosition.mockResolvedValue({
        worldX: 500,
        worldY: 300,
        chunkId: 'world:7:4',
        direction: 'right',
      });

      const authData: AuthData = {
        userId: 'user-returning',
        email: 'ret@test.com',
      };

      room.onCreate({ chunkId: 'city:capital' });

      // Act
      await room.onJoin(mockClient as never, {}, authData);

      // Verify: loadPosition was called with userId
      expect(mockLoadPosition).toHaveBeenCalledWith({}, 'user-returning');

      // Verify: World.addPlayer was called with saved position
      expect(mockWorld.addPlayer).toHaveBeenCalledTimes(1);
      const addedPlayer = mockWorld.addPlayer.mock.calls[0][0];
      expect(addedPlayer.worldX).toBe(500);
      expect(addedPlayer.worldY).toBe(300);
      expect(addedPlayer.chunkId).toBe('world:7:4');
      expect(addedPlayer.direction).toBe('right');

      // Verify: schema reflects saved position
      const chunkPlayer = room.state.players.get('test-session-id');
      expect(chunkPlayer).toBeDefined();
      expect(chunkPlayer?.worldX).toBe(500);
      expect(chunkPlayer?.worldY).toBe(300);
      expect(chunkPlayer?.direction).toBe('right');
    });
  });

  /* ================================================================ */
  /*  INT-2: Movement + Chunk Transition Integration                  */
  /* ================================================================ */
  describe('handleMove integration', () => {
    it('AC6.4: move message delegates to World and updates schema with authoritative position', async () => {
      // Arrange: join a player first
      mockLoadPosition.mockResolvedValue({
        worldX: 100,
        worldY: 200,
        chunkId: 'world:1:3',
        direction: 'down',
      });
      mockWorld.movePlayer.mockReturnValue({
        worldX: 103,
        worldY: 200,
        chunkChanged: false,
      });
      mockWorld.getPlayer.mockReturnValue({
        id: 'test-session-id',
        sessionId: 'test-session-id',
        userId: 'user-mover',
        worldX: 103,
        worldY: 200,
        chunkId: 'world:1:3',
        direction: 'right',
        skin: 'scout_1',
        name: 'mover',
      });

      const authData: AuthData = {
        userId: 'user-mover',
        email: 'mover@test.com',
      };

      room.onCreate({ chunkId: 'world:1:3' });
      await room.onJoin(mockClient as never, {}, authData);

      // Act: trigger the move message handler
      const moveHandler = messageHandlers.get('move');
      expect(moveHandler).toBeDefined();
      moveHandler!(mockClient, { dx: 3, dy: 0 });

      // Verify: World.movePlayer was called with correct args
      expect(mockWorld.movePlayer).toHaveBeenCalledWith(
        'test-session-id',
        3,
        0
      );

      // Verify: schema updated with authoritative position
      const chunkPlayer = room.state.players.get('test-session-id');
      expect(chunkPlayer?.worldX).toBe(103);
      expect(chunkPlayer?.worldY).toBe(200);

      // Verify: no chunk transition message sent
      expect(mockClient.send).not.toHaveBeenCalledWith(
        ServerMessage.CHUNK_TRANSITION,
        expect.anything()
      );
    });

    it('AC7.1: move crossing chunk boundary triggers transition message to client', async () => {
      // Arrange: join a player near chunk boundary
      mockLoadPosition.mockResolvedValue({
        worldX: 126,
        worldY: 200,
        chunkId: 'world:1:3',
        direction: 'right',
      });
      mockWorld.movePlayer.mockReturnValue({
        worldX: 129,
        worldY: 200,
        chunkChanged: true,
        oldChunkId: 'world:1:3',
        newChunkId: 'world:2:3',
      });
      mockWorld.getPlayer.mockReturnValue({
        id: 'test-session-id',
        sessionId: 'test-session-id',
        userId: 'user-border',
        worldX: 129,
        worldY: 200,
        chunkId: 'world:2:3',
        direction: 'right',
        skin: 'scout_1',
        name: 'border',
      });

      const authData: AuthData = {
        userId: 'user-border',
        email: 'border@test.com',
      };

      room.onCreate({ chunkId: 'world:1:3' });
      await room.onJoin(mockClient as never, {}, authData);

      // Act: trigger the move message handler
      const moveHandler = messageHandlers.get('move');
      expect(moveHandler).toBeDefined();
      moveHandler!(mockClient, { dx: 3, dy: 0 });

      // Verify: World.movePlayer was called
      expect(mockWorld.movePlayer).toHaveBeenCalledWith(
        'test-session-id',
        3,
        0
      );

      // Verify: client received CHUNK_TRANSITION message
      expect(mockClient.send).toHaveBeenCalledWith(
        ServerMessage.CHUNK_TRANSITION,
        { newChunkId: 'world:2:3' }
      );
    });
  });

  /* ================================================================ */
  /*  INT-3: Disconnect + Position Persistence Integration            */
  /* ================================================================ */
  describe('onLeave integration', () => {
    it('AC9.1: disconnect saves position to DB and removes player from World', async () => {
      // Arrange: join a player with saved position
      mockLoadPosition.mockResolvedValue({
        worldX: 500,
        worldY: 300,
        chunkId: 'world:7:4',
        direction: 'left',
      });
      mockSavePosition.mockResolvedValue(undefined);

      const authData: AuthData = {
        userId: 'user-leaving',
        email: 'leave@test.com',
      };

      room.onCreate({ chunkId: 'world:7:4' });
      await room.onJoin(mockClient as never, {}, authData);

      // Setup: World.getPlayer returns the player state for onLeave
      mockWorld.getPlayer.mockReturnValue({
        id: 'test-session-id',
        sessionId: 'test-session-id',
        userId: 'user-leaving',
        worldX: 500,
        worldY: 300,
        chunkId: 'world:7:4',
        direction: 'left',
        skin: 'scout_1',
        name: 'leave',
      });

      // Act
      await room.onLeave(mockClient as never);

      // Verify: savePosition was called with correct data
      expect(mockSavePosition).toHaveBeenCalledWith(
        {},
        {
          userId: 'user-leaving',
          worldX: 500,
          worldY: 300,
          chunkId: 'world:7:4',
          direction: 'left',
        }
      );

      // Verify: World.removePlayer was called
      expect(mockWorld.removePlayer).toHaveBeenCalledWith('test-session-id');

      // Verify: player removed from schema
      expect(room.state.players.has('test-session-id')).toBe(false);
    });

    it('AC9.3: save failure logs error but disconnect completes without player stuck state', async () => {
      // Arrange: join a player
      mockLoadPosition.mockResolvedValue({
        worldX: 500,
        worldY: 300,
        chunkId: 'world:7:4',
        direction: 'left',
      });

      const authData: AuthData = {
        userId: 'user-failing',
        email: 'fail@test.com',
      };

      room.onCreate({ chunkId: 'world:7:4' });
      await room.onJoin(mockClient as never, {}, authData);

      // Setup: savePosition rejects with a DB error
      mockSavePosition.mockRejectedValue(new Error('DB connection lost'));

      // Setup: World.getPlayer returns the player state for onLeave
      mockWorld.getPlayer.mockReturnValue({
        id: 'test-session-id',
        sessionId: 'test-session-id',
        userId: 'user-failing',
        worldX: 500,
        worldY: 300,
        chunkId: 'world:7:4',
        direction: 'left',
        skin: 'scout_1',
        name: 'fail',
      });

      // Spy on console.error to verify error logging
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {
          /* suppress output */
        });

      // Act: onLeave should not throw even when save fails
      await expect(
        room.onLeave(mockClient as never)
      ).resolves.not.toThrow();

      // Verify: savePosition was attempted
      expect(mockSavePosition).toHaveBeenCalled();

      // Verify: error was logged
      expect(consoleErrorSpy).toHaveBeenCalled();

      // Verify: World.removePlayer was STILL called (cleanup proceeds)
      expect(mockWorld.removePlayer).toHaveBeenCalledWith('test-session-id');

      // Verify: player removed from schema
      expect(room.state.players.has('test-session-id')).toBe(false);

      consoleErrorSpy.mockRestore();
    });
  });

  /* ================================================================ */
  /*  INT-4: Map Loading/Generation Integration                       */
  /* ================================================================ */
  describe('Map and Session Integration', () => {
    it('onJoin new player: generates map, saves to DB, sends MAP_DATA', async () => {
      // Arrange: loadMap returns null (new player)
      mockLoadMap.mockResolvedValue(null);

      const authData: AuthData = {
        userId: 'user-map-new',
        email: 'mapnew@test.com',
      };

      room.onCreate({ chunkId: 'city:capital' });

      // Act
      await room.onJoin(mockClient as never, {}, authData);

      // Verify: loadMap was called with db instance and userId
      expect(mockLoadMap).toHaveBeenCalledWith({}, 'user-map-new');

      // Verify: map generator was created and generate was called
      expect(mockCreateMapGenerator).toHaveBeenCalledWith(CHUNK_SIZE, CHUNK_SIZE);
      expect(mockGenerate).toHaveBeenCalledWith(expect.any(Number));

      // Verify: saveMap was called with generated map data
      expect(mockSaveMap).toHaveBeenCalledWith(
        {},
        expect.objectContaining({
          userId: 'user-map-new',
          seed: 42,
          grid: expect.anything(),
          layers: expect.anything(),
          walkable: expect.anything(),
        })
      );

      // Verify: MAP_DATA was sent to client
      expect(mockClient.send).toHaveBeenCalledWith(
        ServerMessage.MAP_DATA,
        expect.objectContaining({
          seed: 42,
          width: 64,
          height: 64,
          grid: expect.anything(),
          layers: expect.anything(),
          walkable: expect.anything(),
        })
      );
    });

    it('onJoin returning player: loads map from DB, sends MAP_DATA without generation', async () => {
      // Arrange: loadMap returns saved map data (returning player)
      const savedMap = {
        seed: 99,
        grid: [[{ terrain: 'water', elevation: 0, meta: {} }]],
        layers: [{ name: 'base', terrainKey: 'water', frames: [[5]] }],
        walkable: [[false]],
      };
      mockLoadMap.mockResolvedValue(savedMap);

      const authData: AuthData = {
        userId: 'user-map-returning',
        email: 'mapret@test.com',
      };

      room.onCreate({ chunkId: 'city:capital' });

      // Act
      await room.onJoin(mockClient as never, {}, authData);

      // Verify: loadMap was called with userId
      expect(mockLoadMap).toHaveBeenCalledWith({}, 'user-map-returning');

      // Verify: map generator was NOT called (map loaded from DB)
      expect(mockCreateMapGenerator).not.toHaveBeenCalled();

      // Verify: saveMap was NOT called (no new map to save)
      expect(mockSaveMap).not.toHaveBeenCalled();

      // Verify: MAP_DATA sent with loaded data including the saved seed
      expect(mockClient.send).toHaveBeenCalledWith(
        ServerMessage.MAP_DATA,
        expect.objectContaining({ seed: 99 })
      );
    });

    it('onJoin map generation failure: sends ERROR, does not crash', async () => {
      // Arrange: loadMap returns null, generator throws
      mockLoadMap.mockResolvedValue(null);
      mockGenerate.mockImplementation(() => {
        throw new Error('Generation failed');
      });
      mockCreateMapGenerator.mockReturnValue({ generate: mockGenerate });

      const authData: AuthData = {
        userId: 'user-map-error',
        email: 'maperr@test.com',
      };

      // Suppress console.error output during this test
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {
          /* suppress output */
        });

      room.onCreate({ chunkId: 'city:capital' });

      // Act: should NOT throw
      await expect(
        room.onJoin(mockClient as never, {}, authData)
      ).resolves.not.toThrow();

      // Verify: ERROR message was sent to client
      expect(mockClient.send).toHaveBeenCalledWith(
        ServerMessage.ERROR,
        expect.objectContaining({ message: expect.any(String) })
      );

      // Verify: MAP_DATA was NOT sent
      const mapDataCall = (mockClient.send as jest.Mock).mock.calls.find(
        (call: unknown[]) => call[0] === ServerMessage.MAP_DATA
      );
      expect(mapDataCall).toBeUndefined();

      consoleErrorSpy.mockRestore();
    });

    it('onAuth with duplicate session: calls checkAndKick with userId', async () => {
      // Arrange: configure verifyNextAuthToken to return a valid payload
      const mockVerify = verifyNextAuthToken as jest.Mock;
      mockVerify.mockResolvedValue({
        userId: 'user-dup-session',
        email: 'dup@test.com',
        sub: 'user-dup-session',
        iat: 1000,
        exp: 2000,
        jti: 'test-jti',
      });

      room.onCreate({ chunkId: 'city:capital' });

      // Act: call onAuth with a token
      const authData = await room.onAuth(
        mockClient as never,
        { token: 'valid-jwt-token' },
        {} as never
      );

      // Verify: checkAndKick was called with the userId from the token
      expect(mockSessionTracker.checkAndKick).toHaveBeenCalledWith(
        'user-dup-session'
      );

      // Verify: auth data returned (new client can proceed)
      expect(authData).toBeDefined();
      expect(authData.userId).toBe('user-dup-session');
      expect(authData.email).toBe('dup@test.com');
    });
  });
});
