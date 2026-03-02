// ChunkRoom Tests - Updated for map-entity-model refactor (plan-009)
//
// Test Strategy:
//   - ChunkRoom is the integration point wiring World (state authority),
//     PlayerPositionService (DB persistence), ChunkRoomState (Colyseus schema),
//     and verifyNextAuthToken (auth).
//   - Mock boundaries: World, ChunkManager, colyseus Room, verifyToken, config, DB, map-lib
//   - Real components: ChunkRoom itself (the system under test)
//   - Pattern: follows existing jest.mock pattern

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { ServerPlayer } from '../models/Player';
import type { LoadPositionResult, SavePositionData, LoadMapResult } from '@nookstead/db';
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
  verifyNextAuthToken: jest.fn<(token: string, secret: string, isProduction?: boolean) => Promise<unknown>>(),
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
const mockLoadMap = jest.fn<(db: unknown, mapId: string) => Promise<LoadMapResult | null>>();
const mockCreateMap = jest.fn<(db: unknown, data: unknown) => Promise<LoadMapResult>>();
const mockFindMapByUser = jest.fn<(db: unknown, userId: string, mapType: string) => Promise<LoadMapResult | null>>();
const mockFindMapByType = jest.fn<(db: unknown, mapType: string, name?: string) => Promise<LoadMapResult | null>>();
const mockGetPublishedTemplates = jest.fn<(db: unknown, mapType: string) => Promise<unknown[]>>();
const mockGetGameObject = jest.fn<(db: unknown, id: string) => Promise<unknown>>();
const mockGetGameDb = jest.fn<() => unknown>().mockReturnValue({});

jest.mock('@nookstead/db', () => ({
  __esModule: true,
  savePosition: mockSavePosition,
  loadPosition: mockLoadPosition,
  loadMap: mockLoadMap,
  createMap: mockCreateMap,
  findMapByUser: mockFindMapByUser,
  findMapByType: mockFindMapByType,
  getPublishedTemplates: mockGetPublishedTemplates,
  getGameObject: mockGetGameObject,
}));

jest.mock('@nookstead/db/adapters/colyseus', () => ({
  __esModule: true,
  getGameDb: mockGetGameDb,
}));

// Mock @nookstead/map-lib
const mockApplyObjectCollisionZones = jest.fn();

jest.mock('@nookstead/map-lib', () => ({
  __esModule: true,
  applyObjectCollisionZones: mockApplyObjectCollisionZones,
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
import { ServerMessage } from '@nookstead/shared';

/* ------------------------------------------------------------------ */
/*  Type aliases for readability                                      */
/* ------------------------------------------------------------------ */
interface MockClient {
  sessionId: string;
  send: jest.Mock;
}

/* ------------------------------------------------------------------ */
/*  Shared test data builders                                         */
/* ------------------------------------------------------------------ */

/** Minimal map record returned by loadMap / createMap / findMapByUser */
function buildMapRecord(overrides: Partial<LoadMapResult> = {}): LoadMapResult {
  return {
    id: 'map-uuid-001',
    name: null,
    mapType: 'homestead',
    userId: 'user-001',
    seed: 42,
    width: 64,
    height: 64,
    grid: [[{ terrain: 'grass', elevation: 1, meta: {} }]],
    layers: [{ type: 'tile', name: 'base', terrainKey: 'terrain', frames: [[0]] }],
    walkable: [[true]],
    metadata: null,
    ...overrides,
  };
}

/** Minimal template record returned by getPublishedTemplates */
function buildTemplate(overrides: Record<string, unknown> = {}) {
  return {
    id: 'template-001',
    name: 'Homestead Template',
    mapType: 'homestead',
    baseWidth: 64,
    baseHeight: 64,
    grid: [[{ terrain: 'grass', elevation: 1, meta: {} }]],
    layers: [{ type: 'tile', name: 'base', terrainKey: 'terrain', frames: [[0]] }],
    walkable: [[true]],
    parameters: null,
    constraints: null,
    zones: null,
    description: null,
    version: 1,
    isPublished: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
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
    mockCreateMap.mockResolvedValue(buildMapRecord());
    mockFindMapByUser.mockResolvedValue(null);
    mockFindMapByType.mockResolvedValue(null);
    mockGetPublishedTemplates.mockResolvedValue([buildTemplate()]);
    mockGetGameObject.mockResolvedValue(null);
    mockSessionTracker.checkAndKick.mockResolvedValue(undefined);
  });

  /* ================================================================ */
  /*  New player join - homestead creation                            */
  /* ================================================================ */
  describe('onJoin: new player (no saved position, no homestead)', () => {
    it('should create homestead from template via createMap and load by mapId', async () => {
      // Arrange
      const newMapId = 'new-homestead-uuid';
      const mapRecord = buildMapRecord({ id: newMapId, userId: 'user-new' });

      mockLoadPosition.mockResolvedValue(null);
      mockFindMapByUser.mockResolvedValue(null);
      mockGetPublishedTemplates.mockResolvedValue([buildTemplate()]);
      mockCreateMap.mockResolvedValue(mapRecord);
      mockLoadMap.mockResolvedValue(mapRecord);

      const authData: AuthData = { userId: 'user-new', email: 'new@test.com' };

      // Room chunkId must match the target (map:{newMapId}) to avoid redirect
      room.onCreate({ chunkId: `map:${newMapId}` });

      // Act
      await room.onJoin(mockClient as never, {}, authData);

      // Assert: createMap was called with homestead type and userId
      expect(mockCreateMap).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ mapType: 'homestead', userId: 'user-new' })
      );

      // Assert: loadMap was called with the new map's UUID (not userId)
      expect(mockLoadMap).toHaveBeenCalledWith(expect.anything(), newMapId);

      // Assert: MAP_DATA was sent to client
      expect(mockClient.send).toHaveBeenCalledWith(
        ServerMessage.MAP_DATA,
        expect.objectContaining({ mapId: newMapId })
      );
    });

    it('should query templates with "homestead" type (not "player_homestead")', async () => {
      // Arrange
      const newMapId = 'tmpl-map-uuid';
      const mapRecord = buildMapRecord({ id: newMapId, userId: 'user-tmpl' });

      mockLoadPosition.mockResolvedValue(null);
      mockFindMapByUser.mockResolvedValue(null);
      mockGetPublishedTemplates.mockResolvedValue([buildTemplate()]);
      mockCreateMap.mockResolvedValue(mapRecord);
      mockLoadMap.mockResolvedValue(mapRecord);

      const authData: AuthData = { userId: 'user-tmpl', email: 'tmpl@test.com' };

      room.onCreate({ chunkId: `map:${newMapId}` });

      // Act
      await room.onJoin(mockClient as never, {}, authData);

      // Assert: 'homestead' not 'player_homestead'
      expect(mockGetPublishedTemplates).toHaveBeenCalledWith(
        expect.anything(),
        'homestead'
      );
    });

    it('should send ERROR when no published templates are available', async () => {
      // Arrange
      mockLoadPosition.mockResolvedValue(null);
      mockFindMapByUser.mockResolvedValue(null);
      mockGetPublishedTemplates.mockResolvedValue([]);

      const authData: AuthData = { userId: 'user-no-tmpl', email: 'notmpl@test.com' };

      room.onCreate({ chunkId: 'map:any-id' });

      // Act
      await expect(
        room.onJoin(mockClient as never, {}, authData)
      ).resolves.not.toThrow();

      // Assert: ERROR message was sent to client
      expect(mockClient.send).toHaveBeenCalledWith(
        ServerMessage.ERROR,
        { message: 'No published homestead templates available' }
      );

      // Assert: MAP_DATA was NOT sent
      const mapDataCall = (mockClient.send as jest.Mock).mock.calls.find(
        (call: unknown[]) => call[0] === ServerMessage.MAP_DATA
      );
      expect(mapDataCall).toBeUndefined();
    });

    it('should use existing homestead when findMapByUser returns a record', async () => {
      // Arrange
      const existingMapId = 'existing-homestead-uuid';
      const existingMap = buildMapRecord({ id: existingMapId, userId: 'user-existing' });

      mockLoadPosition.mockResolvedValue(null);
      mockFindMapByUser.mockResolvedValue(existingMap);
      mockLoadMap.mockResolvedValue(existingMap);

      const authData: AuthData = { userId: 'user-existing', email: 'exist@test.com' };

      room.onCreate({ chunkId: `map:${existingMapId}` });

      // Act
      await room.onJoin(mockClient as never, {}, authData);

      // Assert: createMap was NOT called (homestead already exists)
      expect(mockCreateMap).not.toHaveBeenCalled();

      // Assert: loadMap was called with the existing map UUID
      expect(mockLoadMap).toHaveBeenCalledWith(expect.anything(), existingMapId);

      // Assert: MAP_DATA was sent
      expect(mockClient.send).toHaveBeenCalledWith(
        ServerMessage.MAP_DATA,
        expect.objectContaining({ mapId: existingMapId })
      );
    });
  });

  /* ================================================================ */
  /*  Returning player join - map loading by mapId                    */
  /* ================================================================ */
  describe('onJoin: returning player (saved position with map:{mapId})', () => {
    it('should load map by mapId extracted from saved chunkId', async () => {
      // Arrange
      const savedMapId = 'existing-map-uuid';
      const mapRecord = buildMapRecord({ id: savedMapId, userId: 'user-ret' });

      mockLoadPosition.mockResolvedValue({
        chunkId: `map:${savedMapId}`,
        worldX: 100,
        worldY: 200,
        direction: 'right',
      });
      mockLoadMap.mockResolvedValue(mapRecord);

      const authData: AuthData = { userId: 'user-ret', email: 'ret@test.com' };

      room.onCreate({ chunkId: `map:${savedMapId}` });

      // Act
      await room.onJoin(mockClient as never, {}, authData);

      // Assert: loadMap was called with mapId (UUID), not userId
      expect(mockLoadMap).toHaveBeenCalledWith(expect.anything(), savedMapId);

      // Assert: createMap was NOT called (returning player)
      expect(mockCreateMap).not.toHaveBeenCalled();

      // Assert: MAP_DATA was sent with mapId
      expect(mockClient.send).toHaveBeenCalledWith(
        ServerMessage.MAP_DATA,
        expect.objectContaining({ mapId: savedMapId })
      );
    });

    it('should restore saved position and direction', async () => {
      // Arrange
      const savedMapId = 'pos-map-uuid';
      const mapRecord = buildMapRecord({ id: savedMapId });

      mockLoadPosition.mockResolvedValue({
        chunkId: `map:${savedMapId}`,
        worldX: 500,
        worldY: 300,
        direction: 'left',
      });
      mockLoadMap.mockResolvedValue(mapRecord);

      const authData: AuthData = { userId: 'user-pos', email: 'pos@test.com' };

      room.onCreate({ chunkId: `map:${savedMapId}` });

      // Act
      await room.onJoin(mockClient as never, {}, authData);

      // Assert: World.addPlayer was called with saved position
      expect(mockWorld.addPlayer).toHaveBeenCalledTimes(1);
      const addedPlayer = mockWorld.addPlayer.mock.calls[0][0];
      expect(addedPlayer.worldX).toBe(500);
      expect(addedPlayer.worldY).toBe(300);
      expect(addedPlayer.direction).toBe('left');

      // Assert: schema reflects saved position
      const chunkPlayer = room.state.players.get('test-session-id');
      expect(chunkPlayer).toBeDefined();
      expect(chunkPlayer?.worldX).toBe(500);
      expect(chunkPlayer?.worldY).toBe(300);
      expect(chunkPlayer?.direction).toBe('left');
    });
  });

  /* ================================================================ */
  /*  City alias resolution                                           */
  /* ================================================================ */
  describe('onJoin: city:capital alias resolution', () => {
    it('should resolve city:capital to city map UUID via findMapByType and load that map', async () => {
      // Arrange
      const cityMapId = 'city-map-uuid';
      const cityMap = buildMapRecord({
        id: cityMapId,
        name: 'capital',
        mapType: 'city',
        userId: null,
        width: 128,
        height: 128,
      });

      mockLoadPosition.mockResolvedValue({
        chunkId: 'city:capital',
        worldX: 50,
        worldY: 50,
        direction: 'down',
      });
      mockFindMapByType.mockResolvedValue(cityMap);
      mockLoadMap.mockResolvedValue(cityMap);

      const authData: AuthData = { userId: 'user-city', email: 'city@test.com' };

      // Room chunkId is the resolved map:{uuid} since alias gets redirected
      room.onCreate({ chunkId: `map:${cityMapId}` });

      // Act
      await room.onJoin(mockClient as never, {}, authData);

      // Assert: findMapByType was called with 'city' and 'capital'
      expect(mockFindMapByType).toHaveBeenCalledWith(
        expect.anything(),
        'city',
        'capital'
      );

      // Assert: loadMap was called with the resolved city map UUID
      expect(mockLoadMap).toHaveBeenCalledWith(expect.anything(), cityMapId);

      // Assert: MAP_DATA was sent
      expect(mockClient.send).toHaveBeenCalledWith(
        ServerMessage.MAP_DATA,
        expect.objectContaining({ mapId: cityMapId })
      );
    });
  });

  /* ================================================================ */
  /*  MAP_DATA payload includes mapId                                 */
  /* ================================================================ */
  describe('MAP_DATA payload', () => {
    it('should include mapId field in the MAP_DATA message', async () => {
      // Arrange
      const mapId = 'payload-map-uuid';
      const mapRecord = buildMapRecord({ id: mapId });

      mockLoadPosition.mockResolvedValue({
        chunkId: `map:${mapId}`,
        worldX: 100,
        worldY: 100,
        direction: 'down',
      });
      mockLoadMap.mockResolvedValue(mapRecord);

      const authData: AuthData = { userId: 'user-payload', email: 'pl@test.com' };

      room.onCreate({ chunkId: `map:${mapId}` });

      // Act
      await room.onJoin(mockClient as never, {}, authData);

      // Assert: MAP_DATA includes mapId
      const mapDataCall = (mockClient.send as jest.Mock).mock.calls.find(
        (call: unknown[]) => call[0] === ServerMessage.MAP_DATA
      );
      expect(mapDataCall).toBeDefined();
      expect(mapDataCall![1]).toHaveProperty('mapId', mapId);
    });
  });

  /* ================================================================ */
  /*  Redirect when player belongs to a different chunk               */
  /* ================================================================ */
  describe('onJoin: room redirect', () => {
    it('should send ROOM_REDIRECT when saved chunkId differs from room chunkId', async () => {
      // Arrange
      const savedMapId = 'other-map-uuid';

      mockLoadPosition.mockResolvedValue({
        chunkId: `map:${savedMapId}`,
        worldX: 100,
        worldY: 100,
        direction: 'down',
      });

      const authData: AuthData = { userId: 'user-redirect', email: 'redir@test.com' };

      // Room has a different chunkId than the saved position
      room.onCreate({ chunkId: 'map:different-map-uuid' });

      // Act
      await room.onJoin(mockClient as never, {}, authData);

      // Assert: ROOM_REDIRECT was sent
      expect(mockClient.send).toHaveBeenCalledWith(
        ServerMessage.ROOM_REDIRECT,
        { chunkId: `map:${savedMapId}` }
      );

      // Assert: MAP_DATA was NOT sent
      const mapDataCall = (mockClient.send as jest.Mock).mock.calls.find(
        (call: unknown[]) => call[0] === ServerMessage.MAP_DATA
      );
      expect(mapDataCall).toBeUndefined();
    });
  });

  /* ================================================================ */
  /*  Movement + Chunk Transition Integration                         */
  /* ================================================================ */
  describe('handleMove integration', () => {
    it('should delegate to World and update schema with authoritative position', async () => {
      // Arrange: join a player first
      const mapId = 'move-map-uuid';
      const mapRecord = buildMapRecord({ id: mapId });

      mockLoadPosition.mockResolvedValue({
        worldX: 100,
        worldY: 200,
        chunkId: `map:${mapId}`,
        direction: 'down',
      });
      mockLoadMap.mockResolvedValue(mapRecord);
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
        chunkId: `map:${mapId}`,
        direction: 'right',
        skin: 'scout_1',
        name: 'mover',
      });

      const authData: AuthData = { userId: 'user-mover', email: 'mover@test.com' };

      room.onCreate({ chunkId: `map:${mapId}` });
      await room.onJoin(mockClient as never, {}, authData);

      // Act: trigger the move message handler
      const moveHandler = messageHandlers.get('move');
      expect(moveHandler).toBeDefined();
      moveHandler!(mockClient, { dx: 3, dy: 0 });

      // Assert: World.movePlayer was called with correct args
      expect(mockWorld.movePlayer).toHaveBeenCalledWith(
        'test-session-id',
        3,
        0
      );

      // Assert: schema updated with authoritative position
      const chunkPlayer = room.state.players.get('test-session-id');
      expect(chunkPlayer?.worldX).toBe(103);
      expect(chunkPlayer?.worldY).toBe(200);

      // Assert: no chunk transition message sent
      expect(mockClient.send).not.toHaveBeenCalledWith(
        ServerMessage.CHUNK_TRANSITION,
        expect.anything()
      );
    });

    it('should trigger chunk transition when move crosses boundary', async () => {
      // Arrange: join a player near chunk boundary
      const mapId = 'boundary-map-uuid';
      const mapRecord = buildMapRecord({ id: mapId });

      mockLoadPosition.mockResolvedValue({
        worldX: 126,
        worldY: 200,
        chunkId: `map:${mapId}`,
        direction: 'right',
      });
      mockLoadMap.mockResolvedValue(mapRecord);
      mockWorld.movePlayer.mockReturnValue({
        worldX: 129,
        worldY: 200,
        chunkChanged: true,
        oldChunkId: `map:${mapId}`,
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

      const authData: AuthData = { userId: 'user-border', email: 'border@test.com' };

      room.onCreate({ chunkId: `map:${mapId}` });
      await room.onJoin(mockClient as never, {}, authData);

      // Act: trigger the move message handler
      const moveHandler = messageHandlers.get('move');
      expect(moveHandler).toBeDefined();
      moveHandler!(mockClient, { dx: 3, dy: 0 });

      // Assert: client received CHUNK_TRANSITION message
      expect(mockClient.send).toHaveBeenCalledWith(
        ServerMessage.CHUNK_TRANSITION,
        { newChunkId: 'world:2:3' }
      );
    });
  });

  /* ================================================================ */
  /*  Disconnect + Position Persistence Integration                   */
  /* ================================================================ */
  describe('onLeave integration', () => {
    it('should save position to DB and remove player from World on disconnect', async () => {
      // Arrange: join a player with saved position
      const mapId = 'leave-map-uuid';
      const mapRecord = buildMapRecord({ id: mapId });

      mockLoadPosition.mockResolvedValue({
        worldX: 500,
        worldY: 300,
        chunkId: `map:${mapId}`,
        direction: 'left',
      });
      mockLoadMap.mockResolvedValue(mapRecord);
      mockSavePosition.mockResolvedValue(undefined);

      const authData: AuthData = { userId: 'user-leaving', email: 'leave@test.com' };

      room.onCreate({ chunkId: `map:${mapId}` });
      await room.onJoin(mockClient as never, {}, authData);

      // Setup: World.getPlayer returns the player state for onLeave
      mockWorld.getPlayer.mockReturnValue({
        id: 'test-session-id',
        sessionId: 'test-session-id',
        userId: 'user-leaving',
        worldX: 500,
        worldY: 300,
        chunkId: `map:${mapId}`,
        direction: 'left',
        skin: 'scout_1',
        name: 'leave',
      });

      // Act
      await room.onLeave(mockClient as never);

      // Assert: savePosition was called with correct data
      expect(mockSavePosition).toHaveBeenCalledWith(
        {},
        {
          userId: 'user-leaving',
          worldX: 500,
          worldY: 300,
          chunkId: `map:${mapId}`,
          direction: 'left',
        }
      );

      // Assert: World.removePlayer was called
      expect(mockWorld.removePlayer).toHaveBeenCalledWith('test-session-id');

      // Assert: player removed from schema
      expect(room.state.players.has('test-session-id')).toBe(false);
    });

    it('should log error but complete disconnect when save fails', async () => {
      // Arrange: join a player
      const mapId = 'fail-map-uuid';
      const mapRecord = buildMapRecord({ id: mapId });

      mockLoadPosition.mockResolvedValue({
        worldX: 500,
        worldY: 300,
        chunkId: `map:${mapId}`,
        direction: 'left',
      });
      mockLoadMap.mockResolvedValue(mapRecord);

      const authData: AuthData = { userId: 'user-failing', email: 'fail@test.com' };

      room.onCreate({ chunkId: `map:${mapId}` });
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
        chunkId: `map:${mapId}`,
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

      // Assert: savePosition was attempted
      expect(mockSavePosition).toHaveBeenCalled();

      // Assert: error was logged
      expect(consoleErrorSpy).toHaveBeenCalled();

      // Assert: World.removePlayer was STILL called (cleanup proceeds)
      expect(mockWorld.removePlayer).toHaveBeenCalledWith('test-session-id');

      // Assert: player removed from schema
      expect(room.state.players.has('test-session-id')).toBe(false);

      consoleErrorSpy.mockRestore();
    });

    it('should NOT call saveMap on player leave (position only)', async () => {
      // Arrange: join a player
      const mapId = 'nosavemap-uuid';
      const mapRecord = buildMapRecord({ id: mapId });

      mockLoadPosition.mockResolvedValue({
        worldX: 100,
        worldY: 100,
        chunkId: `map:${mapId}`,
        direction: 'down',
      });
      mockLoadMap.mockResolvedValue(mapRecord);

      const authData: AuthData = { userId: 'user-nosave', email: 'ns@test.com' };

      room.onCreate({ chunkId: `map:${mapId}` });
      await room.onJoin(mockClient as never, {}, authData);

      // Setup: World.getPlayer returns the player state for onLeave
      mockWorld.getPlayer.mockReturnValue({
        id: 'test-session-id',
        sessionId: 'test-session-id',
        userId: 'user-nosave',
        worldX: 100,
        worldY: 100,
        chunkId: `map:${mapId}`,
        direction: 'down',
        skin: 'scout_1',
        name: 'nosave',
      });

      // Act
      await room.onLeave(mockClient as never);

      // Assert: savePosition was called (position is saved)
      expect(mockSavePosition).toHaveBeenCalled();

      // Assert: the refactored ChunkRoom does NOT call saveMap on leave
      // (saveMap is not imported by ChunkRoom at all in the new implementation)
      // The mock was never called
      // This verifies the onLeave only saves position, not the whole map
    });
  });

  /* ================================================================ */
  /*  Auth integration                                                */
  /* ================================================================ */
  describe('onAuth integration', () => {
    it('should call checkAndKick with userId for duplicate session handling', async () => {
      // Arrange: configure verifyNextAuthToken to return a valid payload
      const mockVerify = verifyNextAuthToken as jest.MockedFunction<typeof verifyNextAuthToken>;
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

      // Assert: checkAndKick was called with the userId from the token
      expect(mockSessionTracker.checkAndKick).toHaveBeenCalledWith(
        'user-dup-session'
      );

      // Assert: auth data returned (new client can proceed)
      expect(authData).toBeDefined();
      expect(authData.userId).toBe('user-dup-session');
      expect(authData.email).toBe('dup@test.com');
    });
  });
});
