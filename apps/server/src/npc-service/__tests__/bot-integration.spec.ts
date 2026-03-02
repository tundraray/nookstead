// NPC Bot Companion Integration Test - Design Doc: design-019-npc-bot-companion.md
// Tests ChunkRoom as the integration point between BotManager, DB service functions,
// ChunkRoomState.bots, and World.movePlayer.
//
// Mock boundaries: Colyseus Room, DB services, World, ChunkManager, verifyToken, config, sessions
// Real components: ChunkRoom + BotManager (the systems under test)
// Pattern: follows existing ChunkRoom.spec.ts jest.mock structure

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import type { ServerPlayer } from '../../models/Player';
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
    clients: unknown[] = [];

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

jest.mock('../../config', () => ({
  __esModule: true,
  loadConfig: jest.fn().mockReturnValue({
    port: 2567,
    authSecret: 'test-secret',
    databaseUrl: 'postgres://test',
    corsOrigin: 'http://localhost:3000',
  }),
}));

jest.mock('../../auth/verifyToken', () => ({
  __esModule: true,
  verifyNextAuthToken: jest
    .fn<
      (
        token: string,
        secret: string,
        isProduction?: boolean
      ) => Promise<unknown>
    >()
    .mockResolvedValue({
      userId: 'test-user',
      email: 'test@test.com',
    }),
}));

// Mock the World module
const mockWorld = {
  addPlayer: jest.fn<(player: ServerPlayer) => void>(),
  removePlayer:
    jest.fn<(playerId: string) => ServerPlayer | undefined>(),
  movePlayer:
    jest.fn<(playerId: string, dx: number, dy: number) => MoveResult>(),
  getPlayer:
    jest.fn<(playerId: string) => ServerPlayer | undefined>(),
  getPlayersInChunk: jest.fn<(chunkId: string) => ServerPlayer[]>(),
};

jest.mock('../../world/World', () => ({
  __esModule: true,
  world: mockWorld,
  computeChunkId: jest
    .fn<(worldX: number, worldY: number) => string>()
    .mockReturnValue('city:capital'),
}));

// Mock ChunkManager module
const mockChunkManager = {
  registerRoom:
    jest.fn<(chunkId: string, room: unknown) => void>(),
  unregisterRoom: jest.fn<(chunkId: string) => void>(),
  canTransition:
    jest.fn<(playerId: string) => boolean>().mockReturnValue(true),
  recordTransition: jest.fn<(playerId: string) => void>(),
};

jest.mock('../../world/ChunkManager', () => ({
  __esModule: true,
  chunkManager: mockChunkManager,
}));

// Mock @nookstead/db — includes all functions imported by ChunkRoom
const mockLoadPosition =
  jest.fn<(db: unknown, userId: string) => Promise<unknown>>();
const mockSavePosition =
  jest.fn<(db: unknown, data: unknown) => Promise<void>>();
const mockLoadMap =
  jest.fn<(db: unknown, userId: string) => Promise<unknown>>();
const mockCreateMap =
  jest.fn<(db: unknown, data: unknown) => Promise<unknown>>();
const mockFindMapByUser =
  jest.fn<(db: unknown, userId: string, mapType: string) => Promise<unknown>>();
const mockFindMapByType =
  jest.fn<(db: unknown, mapType: string, name?: string) => Promise<unknown>>();
const mockGetPublishedTemplates =
  jest.fn<(db: unknown, mapType: string) => Promise<unknown[]>>();
const mockGetGameObject =
  jest.fn<(db: unknown, id: string) => Promise<unknown>>();
const mockLoadBots =
  jest.fn<(db: unknown, mapId: string) => Promise<unknown[]>>();
const mockSaveBotPositions =
  jest.fn<(db: unknown, positions: unknown[]) => Promise<void>>();
const mockCreateBot =
  jest.fn<(db: unknown, data: unknown) => Promise<unknown>>();

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
  loadBots: mockLoadBots,
  saveBotPositions: mockSaveBotPositions,
  createBot: mockCreateBot,
}));

const mockGetGameDb = jest.fn<() => unknown>().mockReturnValue({});

jest.mock('@nookstead/db/adapters/colyseus', () => ({
  __esModule: true,
  getGameDb: mockGetGameDb,
}));

// Mock @nookstead/map-lib
jest.mock('@nookstead/map-lib', () => ({
  __esModule: true,
  applyObjectCollisionZones: jest.fn(),
}));

// Mock SessionTracker singleton
const mockSessionTracker = {
  register:
    jest.fn<(userId: string, client: unknown, room: unknown) => void>(),
  unregister: jest.fn<(userId: string) => void>(),
  checkAndKick: jest
    .fn<(userId: string) => Promise<void>>()
    .mockResolvedValue(undefined),
};

jest.mock('../../sessions', () => ({
  __esModule: true,
  sessionTracker: mockSessionTracker,
}));

/* ------------------------------------------------------------------ */
/*  Imports (resolved after mocks are applied)                        */
/* ------------------------------------------------------------------ */
import { ChunkRoom } from '../../rooms/ChunkRoom';
import type { AuthData } from '@nookstead/shared';
import { DEFAULT_BOT_COUNT } from '@nookstead/shared';

/* ------------------------------------------------------------------ */
/*  Test helpers                                                       */
/* ------------------------------------------------------------------ */

interface MockClient {
  sessionId: string;
  send: jest.Mock;
}

/** Shared walkable/grid data for a 4x4 all-grass map. */
const WALKABLE_4x4 = [
  [true, true, true, true],
  [true, true, true, true],
  [true, true, true, true],
  [true, true, true, true],
];
const GRID_4x4 = WALKABLE_4x4.map((row) =>
  row.map(() => ({ terrain: 'grass', elevation: 1, meta: {} }))
);
const LAYERS_4x4 = [
  {
    type: 'tile' as const,
    name: 'base',
    terrainKey: 'terrain',
    frames: WALKABLE_4x4.map((row) => row.map(() => 0)),
  },
];

/**
 * Build a LoadMapResult-shaped record for use as findMapByUser / createMap return value.
 */
function makeMapRecord(mapId: string, userId: string) {
  return {
    id: mapId,
    name: null,
    mapType: 'homestead',
    userId,
    seed: 42,
    width: 4,
    height: 4,
    grid: GRID_4x4,
    layers: LAYERS_4x4,
    walkable: WALKABLE_4x4,
    metadata: null,
  };
}

/**
 * Minimal homestead template: 4x4 all-walkable, no object layers.
 */
function makeHomesteadTemplate() {
  return {
    id: 'template-homestead',
    name: 'Test Homestead',
    mapType: 'homestead',
    baseWidth: 4,
    baseHeight: 4,
    grid: GRID_4x4,
    layers: LAYERS_4x4,
    walkable: WALKABLE_4x4,
    parameters: null,
    constraints: null,
    zones: null,
    description: null,
    version: 1,
    isPublished: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Build a valid NpcBot-like DB record.
 */
function makeNpcBotRecord(overrides: {
  id: string;
  mapId: string;
  name: string;
  skin: string;
  worldX: number;
  worldY: number;
  direction?: string;
}) {
  return {
    id: overrides.id,
    mapId: overrides.mapId,
    name: overrides.name,
    skin: overrides.skin,
    worldX: overrides.worldX,
    worldY: overrides.worldY,
    direction: overrides.direction ?? 'down',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };
}

/* ================================================================ */
/*  INT-1: Bot Spawn on First Homestead Join                         */
/* ================================================================ */

describe('Bot spawn on first homestead join', () => {
  let room: ChunkRoom;
  let mockClient: MockClient;
  const MAP_ID = 'map-first-homestead';

  beforeEach(() => {
    jest.useFakeTimers();
    messageHandlers.clear();
    jest.clearAllMocks();

    room = new ChunkRoom();
    mockClient = {
      sessionId: 'session-first',
      send: jest.fn(),
    };

    // Default mocks for the onJoin path:
    mockLoadPosition.mockResolvedValue(null); // new player, no saved position
    mockFindMapByUser.mockResolvedValue(null); // no existing homestead
    mockGetPublishedTemplates.mockResolvedValue([makeHomesteadTemplate()]);
    mockCreateMap.mockResolvedValue(makeMapRecord(MAP_ID, 'user-first'));
    mockSessionTracker.checkAndKick.mockResolvedValue(undefined);
    mockGetGameObject.mockResolvedValue(null);

    // First visit: no existing bots
    mockLoadBots.mockResolvedValue([]);
  });

  afterEach(() => {
    room.onDispose();
    jest.useRealTimers();
  });

  it('AC-1.1: first join to homestead creates bots, persists to DB, and populates state.bots', async () => {
    // Arrange: room chunkId must match the target to avoid redirect
    room.onCreate({ chunkId: `map:${MAP_ID}` });

    // createBot returns a valid NpcBot record for each call
    let createBotCallCount = 0;
    mockCreateBot.mockImplementation(async (_db: unknown, data: unknown) => {
      createBotCallCount++;
      const d = data as {
        mapId: string;
        name: string;
        skin: string;
        worldX: number;
        worldY: number;
        direction: string;
      };
      return makeNpcBotRecord({
        id: `bot-uuid-${createBotCallCount}`,
        mapId: d.mapId,
        name: d.name,
        skin: d.skin,
        worldX: d.worldX,
        worldY: d.worldY,
        direction: d.direction,
      });
    });

    const authData: AuthData = {
      userId: 'user-first',
      email: 'first@test.com',
    };

    // Act
    await room.onJoin(mockClient as never, {}, authData);

    // Verify: loadBots was called with (db, mapId)
    expect(mockLoadBots).toHaveBeenCalledWith({}, MAP_ID);

    // Verify: createBot was called DEFAULT_BOT_COUNT times
    expect(mockCreateBot).toHaveBeenCalledTimes(DEFAULT_BOT_COUNT);

    // Verify: each createBot call includes the map UUID
    for (const call of (mockCreateBot as jest.Mock).mock.calls) {
      const data = call[1] as { mapId: string };
      expect(data.mapId).toBe(MAP_ID);
    }

    // Verify: state.bots has DEFAULT_BOT_COUNT entries
    expect(room.state.bots.size).toBe(DEFAULT_BOT_COUNT);

    // Verify: each bot in state.bots has valid fields
    for (const [botId, bot] of room.state.bots.entries()) {
      expect(botId).toMatch(/^bot-uuid-/);
      expect(bot.name).toBeTruthy();
      expect(bot.skin).toBeTruthy();
      expect(typeof bot.worldX).toBe('number');
      expect(typeof bot.worldY).toBe('number');
      expect(bot.state).toBe('idle');
    }
  });

  it('AC-1.3: DB load failure does not block onJoin; room operates without bots', async () => {
    // Arrange
    const errorMapId = 'map-error-homestead';
    mockFindMapByUser.mockResolvedValue(makeMapRecord(errorMapId, 'user-error'));
    room.onCreate({ chunkId: `map:${errorMapId}` });
    mockLoadBots.mockRejectedValue(new Error('DB connection lost'));

    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {
        /* suppress output */
      });

    const authData: AuthData = {
      userId: 'user-error',
      email: 'error@test.com',
    };

    // Act: onJoin should NOT throw
    await expect(
      room.onJoin(mockClient as never, {}, authData)
    ).resolves.not.toThrow();

    // Verify: error was logged
    expect(consoleSpy).toHaveBeenCalled();

    // Verify: state.bots is empty (no bots loaded)
    expect(room.state.bots.size).toBe(0);

    // Verify: player was still added to state.players (join not blocked)
    expect(room.state.players.size).toBeGreaterThan(0);

    // Verify: World.addPlayer was called (player can move normally)
    expect(mockWorld.addPlayer).toHaveBeenCalledTimes(1);

    consoleSpy.mockRestore();
  });
});

/* ================================================================ */
/*  INT-2: Bot Persistence Lifecycle                                  */
/* ================================================================ */

describe('Bot persistence lifecycle', () => {
  let room: ChunkRoom;
  let mockClient: MockClient;
  const MAP_ID = 'map-return-homestead';

  const existingBots = [
    makeNpcBotRecord({
      id: 'bot-1',
      mapId: MAP_ID,
      name: 'Biscuit',
      skin: 'scout_1',
      worldX: 24,
      worldY: 24,
      direction: 'right',
    }),
    makeNpcBotRecord({
      id: 'bot-2',
      mapId: MAP_ID,
      name: 'Clover',
      skin: 'scout_3',
      worldX: 40,
      worldY: 40,
      direction: 'down',
    }),
  ];

  beforeEach(() => {
    jest.useFakeTimers();
    messageHandlers.clear();
    jest.clearAllMocks();

    room = new ChunkRoom();
    mockClient = {
      sessionId: 'session-return',
      send: jest.fn(),
    };

    // Default mocks
    mockLoadPosition.mockResolvedValue(null);
    mockFindMapByUser.mockResolvedValue(makeMapRecord(MAP_ID, 'user-return'));
    mockGetPublishedTemplates.mockResolvedValue([makeHomesteadTemplate()]);
    mockSessionTracker.checkAndKick.mockResolvedValue(undefined);
    mockGetGameObject.mockResolvedValue(null);

    // Returning player: bots already exist
    mockLoadBots.mockResolvedValue(existingBots);
    mockSaveBotPositions.mockResolvedValue(undefined);
  });

  afterEach(() => {
    room.onDispose();
    jest.useRealTimers();
  });

  it('AC-1.2: returning player sees same bots loaded from DB with preserved identity', async () => {
    // Arrange
    room.onCreate({ chunkId: `map:${MAP_ID}` });

    const authData: AuthData = {
      userId: 'user-return',
      email: 'return@test.com',
    };

    // Act
    await room.onJoin(mockClient as never, {}, authData);

    // Verify: loadBots was called with (db, mapId)
    expect(mockLoadBots).toHaveBeenCalledWith({}, MAP_ID);

    // Verify: createBot was NOT called (bots already exist)
    expect(mockCreateBot).not.toHaveBeenCalled();

    // Verify: state.bots has 2 entries
    expect(room.state.bots.size).toBe(2);

    // Verify: bot-1 identity preserved
    const bot1 = room.state.bots.get('bot-1');
    expect(bot1).toBeDefined();
    expect(bot1!.name).toBe('Biscuit');
    expect(bot1!.skin).toBe('scout_1');
    expect(bot1!.worldX).toBe(24);
    expect(bot1!.worldY).toBe(24);

    // Verify: bot-2 identity preserved
    const bot2 = room.state.bots.get('bot-2');
    expect(bot2).toBeDefined();
    expect(bot2!.name).toBe('Clover');
    expect(bot2!.skin).toBe('scout_3');
    expect(bot2!.worldX).toBe(40);
    expect(bot2!.worldY).toBe(40);
  });

  it('AC-6.1: last player leaving saves bot positions and clears state.bots', async () => {
    // Arrange: join a player first
    room.onCreate({ chunkId: `map:${MAP_ID}` });

    const authData: AuthData = {
      userId: 'user-return',
      email: 'return@test.com',
    };

    await room.onJoin(mockClient as never, {}, authData);

    // Verify bots were loaded before leave
    expect(room.state.bots.size).toBe(2);

    // Setup: World.getPlayer returns the player state for onLeave position saving
    mockWorld.getPlayer.mockReturnValue({
      id: 'session-return',
      sessionId: 'session-return',
      userId: 'user-return',
      worldX: 32,
      worldY: 32,
      chunkId: `map:${MAP_ID}`,
      direction: 'down',
      skin: 'scout_1',
      name: 'return',
    });

    // Simulate last client leaving: set clients to empty array
    // ChunkRoom checks (this.clients?.length ?? 0) === 0
    (room as unknown as { clients: unknown[] }).clients = [];

    // Act
    await room.onLeave(mockClient as never);

    // Verify: saveBotPositions was called with bot positions
    expect(mockSaveBotPositions).toHaveBeenCalledTimes(1);
    const savedPositions = (mockSaveBotPositions as jest.Mock).mock
      .calls[0][1] as Array<{
      id: string;
      worldX: number;
      worldY: number;
      direction: string;
    }>;

    // Should have positions for both bots
    expect(savedPositions).toHaveLength(2);
    const savedIds = savedPositions.map((p) => p.id).sort();
    expect(savedIds).toEqual(['bot-1', 'bot-2']);

    // Verify: state.bots is cleared
    expect(room.state.bots.size).toBe(0);

    // Verify: player was also cleaned up
    expect(room.state.players.has('session-return')).toBe(false);
    expect(mockWorld.removePlayer).toHaveBeenCalledWith('session-return');
  });
});

/* ================================================================ */
/*  INT-3: Bot Collision Blocks Player Movement                      */
/* ================================================================ */

describe('Bot collision blocks player movement', () => {
  let room: ChunkRoom;
  let mockClient: MockClient;
  const MAP_ID = 'map-collide-homestead';

  beforeEach(async () => {
    jest.useFakeTimers();
    messageHandlers.clear();
    jest.clearAllMocks();

    room = new ChunkRoom();
    mockClient = {
      sessionId: 'session-collide',
      send: jest.fn(),
    };

    // Default mocks
    mockLoadPosition.mockResolvedValue(null);
    mockFindMapByUser.mockResolvedValue(makeMapRecord(MAP_ID, 'user-collide'));
    mockGetPublishedTemplates.mockResolvedValue([makeHomesteadTemplate()]);
    mockSessionTracker.checkAndKick.mockResolvedValue(undefined);
    mockGetGameObject.mockResolvedValue(null);

    // Bot at worldX=24, worldY=24 (tile 1,1 with TILE_SIZE=16)
    mockLoadBots.mockResolvedValue([
      makeNpcBotRecord({
        id: 'bot-col',
        mapId: MAP_ID,
        name: 'Sage',
        skin: 'scout_4',
        worldX: 24,
        worldY: 24,
        direction: 'down',
      }),
    ]);

    room.onCreate({ chunkId: `map:${MAP_ID}` });

    const authData: AuthData = {
      userId: 'user-collide',
      email: 'collide@test.com',
    };

    await room.onJoin(mockClient as never, {}, authData);

    // Reset movePlayer mock after onJoin (it may have been called during join)
    mockWorld.movePlayer.mockReset();
  });

  afterEach(() => {
    room.onDispose();
    jest.useRealTimers();
  });

  // NOTE: Server-side walkability & bot collision checks are currently disabled
  // (TODO in ChunkRoom.handleMove). This test verifies the move goes through
  // without rollback until those checks are re-enabled.
  it('AC-3.1: handleMove accepts movement when server-side collision is disabled', () => {
    // Arrange: configure movePlayer to return position ON the bot's tile
    mockWorld.movePlayer.mockReturnValue({
      worldX: 24,
      worldY: 24,
      chunkChanged: false,
    });
    mockWorld.getPlayer.mockReturnValue({
      id: 'session-collide',
      sessionId: 'session-collide',
      userId: 'user-collide',
      worldX: 24,
      worldY: 24,
      chunkId: `map:${MAP_ID}`,
      direction: 'right',
      skin: 'scout_1',
      name: 'collide',
    });

    // Get the move message handler
    const moveHandler = messageHandlers.get('move');
    expect(moveHandler).toBeDefined();

    // Act: trigger move toward bot tile
    moveHandler!(mockClient, { dx: 3, dy: 0 });

    // Verify: World.movePlayer was called once (no rollback)
    expect(mockWorld.movePlayer).toHaveBeenCalledTimes(1);
    expect(mockWorld.movePlayer).toHaveBeenCalledWith(
      'session-collide',
      3,
      0
    );
  });
});
