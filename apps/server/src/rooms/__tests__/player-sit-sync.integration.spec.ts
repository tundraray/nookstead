// Player Sit Action Integration Test - Design Doc: design-026-player-sit-action.md
// Generated: 2026-03-26 | Budget Used: 2/3 integration, 1/2 E2E
//
// Tests ChunkRoom as the integration point between:
//   - Client ANIM_STATE message send
//   - Server-side ANIM_STATE handler (validation + schema update)
//   - ChunkPlayer.animState schema field (Colyseus sync to all clients)
//
// Mock boundaries: Colyseus Room, DB services, World, ChunkManager, verifyToken, config
// Real components: ChunkRoom message handler + ChunkPlayer schema (systems under test)
// Pattern: follows existing ChunkRoom.spec.ts and bot-integration.spec.ts jest.mock structure

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import type { MoveResult } from '@nookstead/shared';
import type { ServerPlayer } from '../../models/Player';

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

jest.mock('../../config', () => ({
  __esModule: true,
  loadConfig: jest.fn().mockReturnValue({
    port: 2567,
    authSecret: 'test-secret',
    databaseUrl: 'postgres://test',
    corsOrigin: 'http://localhost:3000',
    openaiApiKey: 'sk-test-key',
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
  jest.fn<(db: unknown, mapId: string) => Promise<unknown>>();
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
  jest.fn<(db: unknown, data: unknown) => Promise<unknown>>().mockImplementation(
    async (_db, data) => {
      const d = data as Record<string, unknown>;
      return {
        id: `bot-${Math.random().toString(36).slice(2, 8)}`,
        mapId: d['mapId'],
        name: d['name'],
        skin: d['skin'],
        worldX: d['worldX'],
        worldY: d['worldY'],
        direction: d['direction'] ?? 'down',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
  );
const mockCreateDialogueSession =
  jest.fn<(db: unknown, data: unknown) => Promise<unknown>>();
const mockEndDialogueSession =
  jest.fn<(db: unknown, sessionId: string) => Promise<void>>();
const mockAddDialogueMessage =
  jest.fn<(db: unknown, data: unknown) => Promise<unknown>>();
const mockGetRecentDialogueHistory =
  jest.fn<(db: unknown, botId: string, userId: string, limit: number) => Promise<unknown[]>>();
const mockGetSessionCountForPair =
  jest.fn<(db: unknown, botId: string, userId: string) => Promise<number>>();
const mockGetEffectiveConfig =
  jest.fn<(db: unknown, botId: string) => Promise<unknown>>();
const mockGetMemoriesForBot =
  jest.fn<(db: unknown, botId: string, userId: string) => Promise<unknown[]>>();
const mockGetOrCreateRelationship =
  jest.fn<(db: unknown, botId: string, userId: string) => Promise<unknown>>();
const mockUpdateRelationship =
  jest.fn<(db: unknown, botId: string, userId: string, data: unknown) => Promise<unknown>>();
const mockUpdateBot =
  jest.fn<(db: unknown, botId: string, data: unknown) => Promise<unknown>>();
const mockGetDialogueSessionMessages =
  jest.fn<(db: unknown, sessionId: string) => Promise<unknown[]>>();

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
  createDialogueSession: mockCreateDialogueSession,
  endDialogueSession: mockEndDialogueSession,
  addDialogueMessage: mockAddDialogueMessage,
  getRecentDialogueHistory: mockGetRecentDialogueHistory,
  getSessionCountForPair: mockGetSessionCountForPair,
  getEffectiveConfig: mockGetEffectiveConfig,
  getMemoriesForBot: mockGetMemoriesForBot,
  getOrCreateRelationship: mockGetOrCreateRelationship,
  updateRelationship: mockUpdateRelationship,
  updateBot: mockUpdateBot,
  getDialogueSessionMessages: mockGetDialogueSessionMessages,
  getBotById: jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue(null),
  hasActiveStatus: jest.fn<(...args: unknown[]) => Promise<boolean>>().mockResolvedValue(false),
  createInventory: jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue({ id: 'inv-001', ownerType: 'player', ownerId: 'test', maxSlots: 20 }),
  loadInventory: jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue(null),
  saveSlots: jest.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined),
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

// Mock DialogueService — AI-powered NPC dialogue
jest.mock('../../npc-service/ai/DialogueService', () => ({
  __esModule: true,
  DialogueService: jest.fn().mockImplementation(() => ({
    streamResponse: jest.fn(),
  })),
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

// Mock InventoryManager
jest.mock('../../inventory', () => ({
  __esModule: true,
  InventoryManager: jest.fn().mockImplementation(() => ({
    initInventory: jest.fn<(...args: unknown[]) => Promise<string>>().mockResolvedValue('inv-001'),
    saveInventory: jest.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined),
    unloadInventory: jest.fn(),
    getHotbarSlots: jest.fn<(inventoryId: string) => unknown[]>().mockReturnValue([]),
    getBackpackSlots: jest.fn<(inventoryId: string) => unknown[]>().mockReturnValue([]),
    moveSlot: jest.fn().mockReturnValue({ success: true, changedSlots: [], hotbarChanged: false }),
    addItem: jest.fn().mockReturnValue({ success: true, changedSlots: [], hotbarChanged: false }),
    dropItem: jest.fn().mockReturnValue({ success: true, changedSlots: [], hotbarChanged: false }),
    getInventoryIdByOwner: jest.fn().mockReturnValue(undefined),
  })),
}));

// Mock @nookstead/ai (imported by ChunkRoom)
jest.mock('@nookstead/ai', () => ({
  __esModule: true,
  generateNpcCharacter: jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue({}),
}));

/* ------------------------------------------------------------------ */
/*  Imports (resolved after mocks are applied)                        */
/* ------------------------------------------------------------------ */
import { ChunkRoom } from '../ChunkRoom';
import type { AuthData } from '@nookstead/shared';
import { ClientMessage } from '@nookstead/shared';

/* ------------------------------------------------------------------ */
/*  Type aliases and test constants                                   */
/* ------------------------------------------------------------------ */
interface MockClient {
  sessionId: string;
  send: jest.Mock;
}

const MAP_ID = 'sit-test-map';

/** Minimal map record for loadMap / findMapByUser / createMap stubs. */
function buildMapRecord(mapId: string, userId: string) {
  return {
    id: mapId,
    name: null,
    mapType: 'homestead',
    userId,
    seed: 42,
    width: 4,
    height: 4,
    grid: [[{ terrain: 'grass', elevation: 1, meta: {} }]],
    layers: [{ type: 'tile', name: 'base', terrainKey: 'terrain', frames: [[0]] }],
    walkable: [[true]],
    metadata: null,
  };
}

/** Minimal homestead template for getPublishedTemplates. */
function buildTemplate() {
  return {
    id: 'template-001',
    name: 'Test Homestead',
    mapType: 'homestead',
    baseWidth: 4,
    baseHeight: 4,
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
  };
}

/**
 * Simulate a player joining the room. Sets up the mock return values
 * for loadPosition, loadMap, and world.getPlayer, then calls onJoin.
 */
async function simulateJoin(
  room: ChunkRoom,
  sessionId: string,
  userId: string
): Promise<MockClient> {
  const client: MockClient = { sessionId, send: jest.fn() };
  const mapRecord = buildMapRecord(MAP_ID, userId);

  mockLoadPosition.mockResolvedValue({
    worldX: 100,
    worldY: 200,
    chunkId: `map:${MAP_ID}`,
    direction: 'down',
  });
  mockLoadMap.mockResolvedValue(mapRecord);
  mockLoadBots.mockResolvedValue([]);
  mockWorld.getPlayer.mockReturnValue({
    id: sessionId,
    sessionId,
    userId,
    worldX: 100,
    worldY: 200,
    chunkId: `map:${MAP_ID}`,
    direction: 'down',
    skin: 'scout_1',
    name: userId,
  });

  const authData: AuthData = { userId, email: `${userId}@test.com` };
  await room.onJoin(client as never, {}, authData);
  return client;
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */
describe('Player Sit Action - Multiplayer Sync', () => {
  let room: ChunkRoom;

  beforeEach(() => {
    jest.useFakeTimers();
    messageHandlers.clear();
    jest.clearAllMocks();

    room = new ChunkRoom();
    room.onCreate({ chunkId: `map:${MAP_ID}` });

    // Reset default mock behaviors for onJoin path
    mockLoadPosition.mockResolvedValue(null);
    mockSavePosition.mockResolvedValue(undefined);
    mockLoadMap.mockResolvedValue(null);
    mockCreateMap.mockResolvedValue(buildMapRecord(MAP_ID, 'default-user'));
    mockFindMapByUser.mockResolvedValue(null);
    mockFindMapByType.mockResolvedValue(null);
    mockGetPublishedTemplates.mockResolvedValue([buildTemplate()]);
    mockGetGameObject.mockResolvedValue(null);
    mockLoadBots.mockResolvedValue([]);
    mockSessionTracker.checkAndKick.mockResolvedValue(undefined);
  });

  afterEach(() => {
    room.onDispose();
    messageHandlers.clear();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  /* ================================================================ */
  /*  INT-1: animState schema sync (AC-8 + AC-9)                     */
  /*  ROI: 82                                                         */
  /*  Business Value: 9 (core multiplayer visibility)                 */
  /*  Frequency: 8 (every sit/stand action)                           */
  /*  Legal: false                                                    */
  /* ================================================================ */

  it('should update ChunkPlayer.animState on schema when server receives valid ANIM_STATE message', async () => {
    // Arrange
    const client = await simulateJoin(room, 'session-A', 'user-A');

    // Verify join default
    const playerBeforeAct = room.state.players.get('session-A');
    expect(playerBeforeAct).toBeDefined();
    expect(playerBeforeAct!.animState).toBe('idle');

    // Act
    const handler = messageHandlers.get(ClientMessage.ANIM_STATE);
    expect(handler).toBeDefined();
    handler!(client, { animState: 'sit' });

    // Assert
    const playerAfterAct = room.state.players.get('session-A');
    expect(playerAfterAct!.animState).toBe('sit');
  });

  /* ================================================================ */
  /*  INT-2: Server rejects unknown animState (AC-10)                 */
  /*  ROI: 68                                                         */
  /*  Business Value: 7 (input validation / security)                 */
  /*  Frequency: 1 (rare/adversarial)                                 */
  /*  Defect Detection: 9 (catches missing server-side validation)    */
  /*  Legal: false                                                    */
  /* ================================================================ */

  it('should reject unknown animState values and leave schema unchanged', async () => {
    // Arrange
    const client = await simulateJoin(room, 'session-B', 'user-B');
    const consoleWarnSpy = jest
      .spyOn(console, 'warn')
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      .mockImplementation(() => {});

    // Act
    const handler = messageHandlers.get(ClientMessage.ANIM_STATE);
    expect(handler).toBeDefined();
    handler!(client, { animState: 'dance' });

    // Assert: animState remains 'idle' (unchanged from join default)
    const player = room.state.players.get('session-B');
    expect(player!.animState).toBe('idle');

    // Assert: warning was logged with the invalid value and session ID
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('dance')
    );
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('session-B')
    );

    consoleWarnSpy.mockRestore();
  });

  /* ================================================================ */
  /*  INT-3: Late-join full state sync (AC-11 + AC-12)                */
  /*  ROI: 75                                                         */
  /*  Business Value: 8 (correct initial state for joining players)   */
  /*  Frequency: 7 (every room join)                                  */
  /*  Defect Detection: 8 (catches missing default or stale state)    */
  /*  Legal: false                                                    */
  /* ================================================================ */

  it('should default new player animState to idle and expose existing seated players via full state sync', async () => {
    // Arrange: Player A joins and sits
    const clientA = await simulateJoin(room, 'session-A', 'user-A');

    // Verify Player A default
    expect(room.state.players.get('session-A')!.animState).toBe('idle');

    // Player A sits
    const handler = messageHandlers.get(ClientMessage.ANIM_STATE);
    expect(handler).toBeDefined();
    handler!(clientA, { animState: 'sit' });
    expect(room.state.players.get('session-A')!.animState).toBe('sit');

    // Act: Player B joins
    await simulateJoin(room, 'session-B', 'user-B');

    // Assert: Player B has default 'idle' animState
    const playerB = room.state.players.get('session-B');
    expect(playerB).toBeDefined();
    expect(playerB!.animState).toBe('idle');

    // Assert: Player A's animState is still 'sit' (not reset by B's join)
    const playerA = room.state.players.get('session-A');
    expect(playerA!.animState).toBe('sit');

    // Assert: both players are in the room state (full state sync includes both)
    expect(room.state.players.size).toBe(2);
  });
});
