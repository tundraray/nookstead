// ChunkRoom Reflection Memory Integration Tests
// Design Doc: design-028-npc-daily-reflection.md — Task 06
//
// Verifies that reflection memories (type='reflection', userId=null) are
// fetched via getReflectionMemories() and merged into the scored memory set
// during handleNpcInteract(). The reflection fetch is wrapped in try/catch
// so failures degrade gracefully (AC16).
//
// Mock boundaries: Colyseus Room, DB services, World, ChunkManager, verifyToken,
//   config, BotManager, memory modules, DialogueService, InventoryManager
// Real components: ChunkRoom.handleNpcInteract (system under test)

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
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
const mockGetMemoriesForBot =
  jest.fn<(db: unknown, botId: string, userId: string) => Promise<unknown[]>>();
const mockGetReflectionMemories =
  jest.fn<(db: unknown, botId: string, limit?: number) => Promise<unknown[]>>();
const mockGetEffectiveConfig =
  jest.fn<(db: unknown, botId: string) => Promise<unknown>>();
const mockGetOrCreateRelationship =
  jest.fn<(db: unknown, botId: string, userId: string) => Promise<unknown>>();
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
const mockLoadBots =
  jest.fn<(db: unknown, mapId: string) => Promise<unknown[]>>();
const mockCreateBot =
  jest.fn<(db: unknown, data: unknown) => Promise<unknown>>();
const mockCreateDialogueSession =
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
  getGameObject: jest
    .fn<(db: unknown, id: string) => Promise<unknown>>()
    .mockResolvedValue(null),
  loadBots: mockLoadBots,
  saveBotPositions: jest
    .fn<(db: unknown, positions: unknown[]) => Promise<void>>()
    .mockResolvedValue(undefined),
  createBot: mockCreateBot,
  createDialogueSession: mockCreateDialogueSession,
  endDialogueSession: jest
    .fn<(db: unknown, sessionId: string) => Promise<void>>()
    .mockResolvedValue(undefined),
  addDialogueMessage: jest
    .fn<(db: unknown, data: unknown) => Promise<unknown>>()
    .mockResolvedValue(undefined),
  getRecentDialogueHistory: jest
    .fn<
      (
        db: unknown,
        botId: string,
        userId: string,
        limit: number
      ) => Promise<unknown[]>
    >()
    .mockResolvedValue([]),
  getSessionCountForPair: jest
    .fn<(db: unknown, botId: string, userId: string) => Promise<number>>()
    .mockResolvedValue(0),
  getEffectiveConfig: mockGetEffectiveConfig,
  getMemoriesForBot: mockGetMemoriesForBot,
  getReflectionMemories: mockGetReflectionMemories,
  getOrCreateRelationship: mockGetOrCreateRelationship,
  updateRelationship: jest
    .fn<
      (
        db: unknown,
        botId: string,
        userId: string,
        data: unknown
      ) => Promise<unknown>
    >()
    .mockResolvedValue(null),
  updateBot: jest
    .fn<(db: unknown, botId: string, data: unknown) => Promise<unknown>>()
    .mockResolvedValue(null),
  getBotById: jest
    .fn<(...args: unknown[]) => Promise<unknown>>()
    .mockResolvedValue(null),
  hasActiveStatus: jest
    .fn<(...args: unknown[]) => Promise<boolean>>()
    .mockResolvedValue(false),
  createInventory: jest
    .fn<(...args: unknown[]) => Promise<unknown>>()
    .mockResolvedValue({
      id: 'inv-001',
      ownerType: 'player',
      ownerId: 'test',
      maxSlots: 20,
    }),
  loadInventory: jest
    .fn<(...args: unknown[]) => Promise<unknown>>()
    .mockResolvedValue(null),
  saveSlots: jest
    .fn<(...args: unknown[]) => Promise<void>>()
    .mockResolvedValue(undefined),
  getDialogueSessionMessages: jest
    .fn<(db: unknown, sessionId: string) => Promise<unknown[]>>()
    .mockResolvedValue([]),
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

// Mock memory module — intercept scoreAndRankMemories to verify input
const mockScoreAndRankMemories = jest.fn<(...args: unknown[]) => unknown[]>();

jest.mock('../../npc-service/memory', () => ({
  __esModule: true,
  scoreAndRankMemories: mockScoreAndRankMemories,
  MemoryStream: jest.fn().mockImplementation(() => ({
    createDialogueMemory: jest.fn(),
  })),
  EmbeddingService: jest.fn().mockImplementation(() => ({
    embedText: jest.fn(),
  })),
  VectorStore: jest.fn().mockImplementation(() => ({
    ensureCollection: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    searchSimilar: jest.fn<() => Promise<unknown[]>>().mockResolvedValue([]),
  })),
  SEMANTIC_TOP_K: 20,
}));

// Mock BotManager — return a controllable mock for NPC interaction methods
const mockBotManagerInstance = {
  init: jest.fn(),
  tick: jest.fn<() => unknown[]>().mockReturnValue([]),
  generateBots: jest.fn<() => unknown[]>().mockReturnValue([]),
  addBot: jest.fn(),
  initBotInventory: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  getBotIds: jest.fn<() => string[]>().mockReturnValue([]),
  getBotPositions: jest.fn<() => unknown[]>().mockReturnValue([]),
  saveAllBotInventories: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  destroy: jest.fn(),
  validateInteraction: jest.fn<(...args: unknown[]) => unknown>(),
  startInteraction: jest.fn<(...args: unknown[]) => boolean>(),
  getBotPersona: jest.fn<(...args: unknown[]) => unknown>(),
  endInteraction: jest.fn(),
  updateBotPersona: jest.fn(),
  isInteracting: jest.fn<() => boolean>().mockReturnValue(false),
};

jest.mock('../../npc-service', () => ({
  __esModule: true,
  BotManager: jest.fn().mockImplementation(() => mockBotManagerInstance),
  createServerBot: jest.fn(),
}));

// Mock DialogueService
jest.mock('../../npc-service/ai/DialogueService', () => ({
  __esModule: true,
  DialogueService: jest.fn().mockImplementation(() => ({
    streamResponse: jest.fn(),
  })),
}));

// Mock NPC tools (imported by ChunkRoom)
jest.mock('../../npc-service/ai/tools/index.js', () => ({
  __esModule: true,
  createNpcTools: jest.fn().mockReturnValue([]),
}));

// Mock relationships module (imported by ChunkRoom)
jest.mock('../../npc-service/relationships/index.js', () => ({
  __esModule: true,
  processAction: jest.fn(),
  evaluateProgression: jest.fn(),
  getAvailableActions: jest.fn<() => unknown[]>().mockReturnValue([]),
  rowToRelationshipData: jest.fn<(row: unknown) => unknown>().mockImplementation((row) => row),
  FATIGUE_DEFAULTS: { baseFatigue: 0, fatigueDecayPerHour: 1 },
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
    initInventory: jest
      .fn<(...args: unknown[]) => Promise<string>>()
      .mockResolvedValue('inv-001'),
    saveInventory: jest
      .fn<(...args: unknown[]) => Promise<void>>()
      .mockResolvedValue(undefined),
    unloadInventory: jest.fn(),
    getHotbarSlots: jest
      .fn<(inventoryId: string) => unknown[]>()
      .mockReturnValue([]),
    getBackpackSlots: jest
      .fn<(inventoryId: string) => unknown[]>()
      .mockReturnValue([]),
    moveSlot: jest.fn().mockReturnValue({
      success: true,
      changedSlots: [],
      hotbarChanged: false,
    }),
    addItem: jest.fn().mockReturnValue({
      success: true,
      changedSlots: [],
      hotbarChanged: false,
    }),
    dropItem: jest.fn().mockReturnValue({
      success: true,
      changedSlots: [],
      hotbarChanged: false,
    }),
    getInventoryIdByOwner: jest.fn().mockReturnValue(undefined),
  })),
}));

// Mock @nookstead/ai (imported by ChunkRoom)
jest.mock('@nookstead/ai', () => ({
  __esModule: true,
  generateNpcCharacter: jest
    .fn<(...args: unknown[]) => Promise<unknown>>()
    .mockResolvedValue({}),
}));

/* ------------------------------------------------------------------ */
/*  Imports (resolved after mocks are applied)                        */
/* ------------------------------------------------------------------ */
import { ChunkRoom } from '../ChunkRoom';
import type { AuthData } from '@nookstead/shared';
import { ClientMessage, ServerMessage } from '@nookstead/shared';

/** Drain the microtask queue so fire-and-forget async handlers complete. */
function flushPromises(): Promise<void> {
  return new Promise((resolve) => process.nextTick(resolve));
}

/* ------------------------------------------------------------------ */
/*  Type aliases and test constants                                   */
/* ------------------------------------------------------------------ */
interface MockClient {
  sessionId: string;
  send: jest.Mock;
  auth?: AuthData;
}

const MAP_ID = 'reflect-test-map';
const BOT_ID = 'reflect-bot-001';
const USER_ID = 'reflect-user-001';

/** Minimal map record for join setup. */
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
    layers: [
      { type: 'tile', name: 'base', terrainKey: 'terrain', frames: [[0]] },
    ],
    walkable: [[true]],
    metadata: null,
  };
}

/** Minimal NPC memory row. */
function buildMemoryRow(overrides: Record<string, unknown> = {}) {
  return {
    id: `mem-${Math.random().toString(36).slice(2, 8)}`,
    botId: BOT_ID,
    userId: USER_ID,
    type: 'interaction',
    content: 'Talked about the weather',
    importance: 5,
    createdAt: new Date('2026-03-27T10:00:00Z'),
    dialogueSessionId: null,
    ...overrides,
  };
}

/** Build a reflection memory row (userId=null, type=reflection). */
function buildReflectionMemory(overrides: Record<string, unknown> = {}) {
  return {
    id: `refl-${Math.random().toString(36).slice(2, 8)}`,
    botId: BOT_ID,
    userId: null,
    type: 'reflection',
    content:
      '[Day reflection] Had a lovely chat with the farmer about crops.\n\nMood: content (7/10)',
    importance: 10,
    createdAt: new Date('2026-03-27T04:00:00Z'),
    dialogueSessionId: null,
    ...overrides,
  };
}

/** Default effective config for memory scoring. */
const DEFAULT_EFFECTIVE_CONFIG = {
  topK: 10,
  halfLifeHours: 24,
  recencyWeight: 0.3,
  importanceWeight: 0.5,
  semanticWeight: 0.2,
  tokenBudget: 2000,
};

/**
 * Simulate a player joining the room. Sets up mock returns for
 * loadPosition, loadMap, and world.getPlayer, then calls onJoin.
 * Also loads a bot into the room state for NPC interaction.
 */
async function simulateJoinWithBot(
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
  // Return a bot record so BotManager loads it
  mockLoadBots.mockResolvedValue([
    {
      id: BOT_ID,
      mapId: MAP_ID,
      name: 'Rosie',
      skin: 'villager_1',
      worldX: 101,
      worldY: 200,
      direction: 'down',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);
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
  // Attach auth data to client mock (ChunkRoom reads client.auth)
  client.auth = authData;
  return client;
}

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */
describe('ChunkRoom — Reflection Memory Integration', () => {
  let room: ChunkRoom;

  beforeEach(() => {
    messageHandlers.clear();
    jest.clearAllMocks();

    room = new ChunkRoom();

    // Reset default mock behaviors for DB
    mockLoadPosition.mockResolvedValue(null);
    mockSavePosition.mockResolvedValue(undefined);
    mockLoadMap.mockResolvedValue(null);
    mockCreateMap.mockResolvedValue(buildMapRecord(MAP_ID, USER_ID));
    mockFindMapByUser.mockResolvedValue(null);
    mockFindMapByType.mockResolvedValue(null);
    mockGetPublishedTemplates.mockResolvedValue([]);
    mockLoadBots.mockResolvedValue([]);
    mockCreateBot.mockResolvedValue(null);
    mockCreateDialogueSession.mockResolvedValue({
      id: 'dialogue-session-001',
    });
    mockGetEffectiveConfig.mockResolvedValue(DEFAULT_EFFECTIVE_CONFIG);
    mockGetMemoriesForBot.mockResolvedValue([]);
    mockGetReflectionMemories.mockResolvedValue([]);
    mockGetOrCreateRelationship.mockResolvedValue({
      id: 'rel-001',
      botId: BOT_ID,
      userId: USER_ID,
      level: 'stranger',
      points: 0,
      interactionCount: 0,
      lastInteraction: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // BotManager mock defaults for NPC interaction
    mockBotManagerInstance.validateInteraction.mockReturnValue({
      success: true,
      botId: BOT_ID,
      name: 'Rosie',
      state: 'idle',
    });
    mockBotManagerInstance.startInteraction.mockReturnValue(true);
    mockBotManagerInstance.getBotPersona.mockReturnValue({
      personality: 'friendly',
      role: 'farmer',
      speechStyle: 'casual',
      bio: null,
      age: null,
      traits: null,
      goals: null,
    });

    // scoreAndRankMemories returns scored versions of whatever is passed
    mockScoreAndRankMemories.mockImplementation((...args: unknown[]) => {
      const memories = args[0] as Array<Record<string, unknown>>;
      return memories.map((m) => ({
        memory: m,
        recencyScore: 0.5,
        importanceScore: m.importance
          ? (m.importance as number) / 10
          : 0.5,
        semanticScore: 0,
        totalScore: 0.5,
      }));
    });
  });

  afterEach(() => {
    room.onDispose();
  });

  /**
   * AC10: Reflection memories with importance=10 are included in the
   * scored memory set passed to scoreAndRankMemories.
   */
  it('should include reflection memories in scored set when available', async () => {
    // Arrange
    room.onCreate({ chunkId: `map:${MAP_ID}` });
    const client = await simulateJoinWithBot(room, 'sess-01', USER_ID);

    const userMemory = buildMemoryRow();
    const reflectionMemory = buildReflectionMemory();

    mockGetMemoriesForBot.mockResolvedValue([userMemory]);
    mockGetReflectionMemories.mockResolvedValue([reflectionMemory]);

    // Act — trigger NPC_INTERACT via the captured message handler
    const handler = messageHandlers.get(ClientMessage.NPC_INTERACT);
    expect(handler).toBeDefined();
    handler!(client, { botId: BOT_ID });
    await flushPromises();

    // Assert — scoreAndRankMemories received both user and reflection memories
    expect(mockScoreAndRankMemories).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ type: 'reflection' }),
        expect.objectContaining({ type: 'interaction' }),
      ]),
      expect.anything(),
      undefined,
      expect.anything()
    );

    // Verify getReflectionMemories was called with botId and limit 3
    expect(mockGetReflectionMemories).toHaveBeenCalledWith(
      expect.anything(),
      BOT_ID,
      3
    );
  });

  /**
   * AC11: Dialogue starts normally when no reflection memories exist.
   */
  it('should proceed normally when no reflection memories exist', async () => {
    // Arrange
    room.onCreate({ chunkId: `map:${MAP_ID}` });
    const client = await simulateJoinWithBot(room, 'sess-02', USER_ID);

    mockGetMemoriesForBot.mockResolvedValue([]);
    mockGetReflectionMemories.mockResolvedValue([]);

    // Act
    const handler = messageHandlers.get(ClientMessage.NPC_INTERACT);
    expect(handler).toBeDefined();
    handler!(client, { botId: BOT_ID });
    await flushPromises();

    // Assert — dialogue started successfully
    expect(client.send).toHaveBeenCalledWith(
      ServerMessage.NPC_INTERACT_RESULT,
      expect.objectContaining({
        success: true,
        dialogueStarted: true,
      })
    );
  });

  /**
   * AC16: Dialogue continues when getReflectionMemories throws
   * (graceful degradation — try/catch around reflection fetch).
   */
  it('should continue dialogue when getReflectionMemories throws', async () => {
    // Arrange
    room.onCreate({ chunkId: `map:${MAP_ID}` });
    const client = await simulateJoinWithBot(room, 'sess-03', USER_ID);

    mockGetMemoriesForBot.mockResolvedValue([]);
    mockGetReflectionMemories.mockRejectedValue(new Error('DB error'));

    const consoleWarnSpy = jest
      .spyOn(console, 'warn')
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      .mockImplementation(() => {});

    // Act
    const handler = messageHandlers.get(ClientMessage.NPC_INTERACT);
    expect(handler).toBeDefined();
    handler!(client, { botId: BOT_ID });
    await flushPromises();

    // Assert — dialogue still started (graceful degradation)
    expect(client.send).toHaveBeenCalledWith(
      ServerMessage.NPC_INTERACT_RESULT,
      expect.objectContaining({
        success: true,
        dialogueStarted: true,
      })
    );

    // Assert — warning was logged about the failure
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Reflection memory fetch failed'),
      expect.any(Error)
    );

    consoleWarnSpy.mockRestore();
  });
});
