import { Room, Client, type AuthContext } from 'colyseus';
import { ChunkRoomState, ChunkPlayer, ChunkBot } from './ChunkRoomState';
import { BotManager } from '../npc-service';
import { verifyNextAuthToken } from '../auth/verifyToken';
import { loadConfig } from '../config';
import { world } from '../world/World';
import { chunkManager } from '../world/ChunkManager';
import { sessionTracker } from '../sessions';
import { createServerPlayer } from '../models/Player';
import { getGameDb } from '@nookstead/db/adapters/colyseus';
import {
  savePosition,
  loadPosition,
  loadMap,
  createMap,
  findMapByUser,
  findMapByType,
  getPublishedTemplates,
  getGameObject,
  loadBots,
  saveBotPositions,
  createBot,
  createDialogueSession,
  endDialogueSession,
  addDialogueMessage,
  getRecentDialogueHistory,
} from '@nookstead/db';
import {
  PATCH_RATE_MS,
  AVAILABLE_SKINS,
  DEFAULT_SPAWN,
  TILE_SIZE,
  DEFAULT_BOT_COUNT,
  ClientMessage,
  ServerMessage,
  findSpawnTile,
  isObjectLayer,
  type MovePayload,
  type PositionUpdatePayload,
  type AuthData,
  type ChunkTransitionPayload,
  type MapDataPayload,
  type Grid,
  type SerializedLayer,
  type CollisionZoneDef,
  type DialogueMessagePayload,
  type DialogueStartPayload,
} from '@nookstead/shared';
import { applyObjectCollisionZones } from '@nookstead/map-lib';
import { DialogueService } from '../npc-service/ai/DialogueService';

const POSITION_SAVE_INTERVAL_MS = 30_000;

// ---------------------------------------------------------------------------
// ChunkId parsing helpers
// ---------------------------------------------------------------------------

type ParsedChunkId =
  | { type: 'map'; mapId: string }
  | { type: 'world'; x: number; y: number }
  | { type: 'alias'; alias: string };

function parseChunkId(chunkId: string): ParsedChunkId {
  if (chunkId.startsWith('map:')) {
    return { type: 'map', mapId: chunkId.slice(4) };
  }
  if (chunkId.startsWith('world:')) {
    const parts = chunkId.split(':');
    return { type: 'world', x: Number(parts[1]), y: Number(parts[2]) };
  }
  // Well-known aliases: city:capital, etc.
  return { type: 'alias', alias: chunkId };
}

async function resolveAlias(
  db: Parameters<typeof findMapByType>[0],
  alias: string
): Promise<string> {
  if (alias === 'city:capital') {
    const cityMap = await findMapByType(db, 'city', 'capital');
    if (!cityMap) {
      throw new Error(
        'No city map found for alias city:capital. Seed a city map first.'
      );
    }
    return cityMap.id;
  }
  throw new Error(`Unknown chunkId alias: ${alias}`);
}

export class ChunkRoom extends Room<{ state: ChunkRoomState }> {
  private chunkId!: string;
  private botManager = new BotManager();

  private mapWalkable: boolean[][] = [];
  private mapGrid: Grid | null = null;
  private botInitInProgress = false;
  private positionSaveTimer: ReturnType<typeof setInterval> | null = null;
  private dialogueSessions = new Map<
    string,
    {
      botId: string;
      dbSessionId: string;
      abortController: AbortController | null;
      persona: {
        personality?: string | null;
        role?: string | null;
        speechStyle?: string | null;
      } | null;
    }
  >();
  private dialogueService: DialogueService | null = null;

  override onCreate(options: Record<string, unknown>): void {
    this.chunkId =
      typeof options?.['chunkId'] === 'string'
        ? options['chunkId']
        : 'city:capital';
    this.setState(new ChunkRoomState());
    this.setPatchRate(PATCH_RATE_MS);

    // Initialize DialogueService for AI-powered NPC conversations
    const config = loadConfig();
    this.dialogueService = new DialogueService({
      apiKey: config.openaiApiKey,
    });

    // Register with ChunkManager
    chunkManager.registerRoom(this.chunkId, this);

    // Message handlers
    this.onMessage(ClientMessage.MOVE, (client, payload: unknown) => {
      this.handleMove(client as Client, payload);
    });

    this.onMessage(
      ClientMessage.POSITION_UPDATE,
      (client, payload: unknown) => {
        this.handlePositionUpdate(client as Client, payload);
      }
    );

    this.onMessage(ClientMessage.NPC_INTERACT, (client, payload: unknown) => {
      this.handleNpcInteract(client as Client, payload);
    });

    this.onMessage(ClientMessage.HARD_RESET, (client) => {
      this.handleHardReset(client as Client);
    });

    this.onMessage(
      ClientMessage.DIALOGUE_MESSAGE,
      (client, payload: unknown) => {
        this.handleDialogueMessage(client as Client, payload);
      }
    );

    this.onMessage(ClientMessage.DIALOGUE_END, (client) => {
      this.handleDialogueEnd(client as Client, 'close');
    });

    // Bot simulation tick (100ms interval, matching PATCH_RATE_MS)
    this.setSimulationInterval((deltaTime) => {
      if (this.state.bots.size === 0) return;
      const updates = this.botManager.tick(deltaTime);
      for (const update of updates) {
        const botSchema = this.state.bots.get(update.id);
        if (botSchema) {
          botSchema.worldX = update.worldX;
          botSchema.worldY = update.worldY;
          botSchema.direction = update.direction;
          botSchema.state = update.state;
        }
      }
    }, PATCH_RATE_MS);

    // Periodic position autosave (protects against server crashes)
    this.positionSaveTimer = setInterval(() => {
      this.saveAllPlayerPositions();
    }, POSITION_SAVE_INTERVAL_MS);

    console.log(
      `[ChunkRoom] Room created: chunk:${this.chunkId}, roomId=${this.roomId}`
    );
  }

  override async onAuth(
    _client: Client,
    options: Record<string, unknown>,
    _context: AuthContext
  ): Promise<AuthData> {
    const token = options['token'];
    if (!token || typeof token !== 'string') {
      throw new Error('No authentication token provided');
    }
    const config = loadConfig();
    const payload = await verifyNextAuthToken(token, config.authSecret);

    // Kick any existing session for this user before accepting the new one
    await sessionTracker.checkAndKick(payload.userId);

    return {
      userId: payload.userId,
      email: payload.email,
    };
  }

  override async onJoin(
    client: Client,
    _options: Record<string, unknown>,
    auth: AuthData
  ): Promise<void> {
    const { userId } = auth;

    const db = getGameDb();

    // 1. Load saved position from DB
    let savedPosition: {
      worldX: number;
      worldY: number;
      chunkId: string;
      direction: string;
    } | null = null;

    try {
      const saved = await loadPosition(db, userId);
      if (saved) {
        savedPosition = saved;
      }
    } catch (error) {
      console.error(
        `[ChunkRoom] Position load failed: userId=${userId}`,
        error
      );
    }

    // 2. Determine target chunkId, mapId, and optionally cache map data
    //    (findMapByUser / createMap already return full map data, so we
    //    keep it around to avoid a redundant loadMap round-trip).
    let targetChunkId: string;
    let mapId: string | null = null;
    let cachedMapData: Awaited<ReturnType<typeof loadMap>> | null = null;

    if (savedPosition) {
      // Returning player: use saved chunkId
      targetChunkId = savedPosition.chunkId;
      const parsed = parseChunkId(targetChunkId);
      if (parsed.type === 'map') {
        mapId = parsed.mapId;
      } else if (parsed.type === 'alias') {
        mapId = await resolveAlias(db, targetChunkId);
        targetChunkId = `map:${mapId}`;
      }
      // world: type is handled by existing positional logic (no mapId)
    } else {
      // No saved position: look up user's homestead or create one
      const existingHomestead = await findMapByUser(db, userId, 'homestead');

      if (existingHomestead) {
        mapId = existingHomestead.id;
        cachedMapData = existingHomestead;
        targetChunkId = `map:${mapId}`;
        console.log(
          `[ChunkRoom] Existing homestead found: userId=${userId}, mapId=${mapId}`
        );
      } else {
        // New player: create homestead from template
        const templates = await getPublishedTemplates(db, 'homestead');
        if (templates.length === 0) {
          client.send(ServerMessage.ERROR, {
            message: 'No published homestead templates available',
          });
          return;
        }

        const template =
          templates[Math.floor(Math.random() * templates.length)];
        const seed = Math.floor(Math.random() * 0x7fffffff);

        console.log(
          `[ChunkRoom] Creating homestead for new player: userId=${userId}, templateId=${template.id}, seed=${seed}`
        );

        const newMap = await createMap(db, {
          mapType: 'homestead',
          userId,
          seed,
          width: template.baseWidth,
          height: template.baseHeight,
          grid: template.grid,
          layers: template.layers,
          walkable: template.walkable,
          metadata: { templateId: template.id },
        });

        mapId = newMap.id;
        cachedMapData = newMap;
        targetChunkId = `map:${mapId}`;
        console.log(
          `[ChunkRoom] Homestead created: userId=${userId}, mapId=${mapId}`
        );
      }
    }

    // 3. Redirect if player belongs in a different chunk
    if (targetChunkId !== this.chunkId) {
      console.log(
        `[ChunkRoom] Redirecting: userId=${userId}, from=${this.chunkId} to=${targetChunkId}`
      );
      client.send(ServerMessage.ROOM_REDIRECT, { chunkId: targetChunkId });
      return;
    }

    // 4. Load map data (use cached data when available to avoid redundant DB query)
    let mapPayload: MapDataPayload;
    let mapWalkable: boolean[][] | null = null;
    let mapGrid: Grid | null = null;

    // If this room is an alias (e.g. city:capital), resolve it now
    if (!mapId) {
      const parsed = parseChunkId(this.chunkId);
      if (parsed.type === 'map') {
        mapId = parsed.mapId;
      } else if (parsed.type === 'alias') {
        mapId = await resolveAlias(db, this.chunkId);
      }
    }

    if (!mapId) {
      console.error(
        `[ChunkRoom] Cannot determine mapId for chunk: ${this.chunkId}`
      );
      client.send(ServerMessage.ERROR, { message: 'Map data unavailable' });
      return;
    }

    try {
      const savedMap = cachedMapData ?? await loadMap(db, mapId);

      if (savedMap) {
        console.log(
          `[ChunkRoom] Map loaded${cachedMapData ? ' (cached)' : ' from DB'}: mapId=${mapId}`
        );
        mapWalkable = savedMap.walkable as boolean[][];
        mapGrid = savedMap.grid as unknown as Grid;
        mapPayload = {
          mapId: savedMap.id,
          seed: savedMap.seed ?? 0,
          width: savedMap.width,
          height: savedMap.height,
          grid: savedMap.grid as MapDataPayload['grid'],
          layers: savedMap.layers as MapDataPayload['layers'],
          walkable: mapWalkable,
        };
      } else {
        console.error(
          `[ChunkRoom] Map not found: mapId=${mapId}`
        );
        client.send(ServerMessage.ERROR, { message: 'Map data unavailable' });
        return;
      }
    } catch (err) {
      console.error(
        `[ChunkRoom] Map load failed: mapId=${mapId}`,
        err
      );
      client.send(ServerMessage.ERROR, { message: 'Map data unavailable' });
      return;
    }

    // 4b. Apply object collision zones to walkability grid
    if (mapWalkable) {
      try {
        const layers = mapPayload.layers as SerializedLayer[];
        const placedObjects: Array<{
          objectId: string;
          gridX: number;
          gridY: number;
        }> = [];
        const objectIdSet = new Set<string>();

        for (const layer of layers) {
          if (isObjectLayer(layer)) {
            for (const obj of layer.objects) {
              placedObjects.push({
                objectId: obj.objectId,
                gridX: obj.gridX,
                gridY: obj.gridY,
              });
              objectIdSet.add(obj.objectId);
            }
          }
        }

        if (placedObjects.length > 0) {
          // Fetch game object definitions from DB
          const objectDefinitions = new Map<
            string,
            { collisionZones: CollisionZoneDef[] }
          >();

          const fetchResults = await Promise.all(
            [...objectIdSet].map((id) => getGameObject(db, id))
          );

          for (const gameObj of fetchResults) {
            if (gameObj) {
              objectDefinitions.set(gameObj.id, {
                collisionZones:
                  (gameObj.collisionZones as CollisionZoneDef[]) ?? [],
              });
            }
          }

          applyObjectCollisionZones(
            mapWalkable,
            placedObjects,
            objectDefinitions,
            TILE_SIZE
          );

          // Update walkable in mapPayload
          mapPayload.walkable = mapWalkable;

          console.log(
            `[ChunkRoom] Object collision zones applied: mapId=${mapId}, objects=${placedObjects.length}, definitions=${objectDefinitions.size}`
          );
        }
      } catch (err) {
        console.warn(
          `[ChunkRoom] Object collision zone application failed (non-fatal): mapId=${mapId}`,
          err
        );
      }
    }

    // Store walkable grid and terrain grid for bot manager / hard reset access
    if (mapWalkable) {
      this.mapWalkable = mapWalkable;
    }
    if (mapGrid) {
      this.mapGrid = mapGrid;
    }

    // 5. Determine spawn position
    let worldX: number;
    let worldY: number;
    let chunkId: string;
    let direction: string;

    if (savedPosition) {
      worldX = savedPosition.worldX;
      worldY = savedPosition.worldY;
      chunkId = targetChunkId;
      direction = savedPosition.direction;
    } else {
      // New player: use targetChunkId (after redirect, this IS the correct chunk)
      chunkId = targetChunkId;
      direction = 'down';

      if (mapWalkable && mapGrid) {
        try {
          const spawn = findSpawnTile(
            mapWalkable,
            mapGrid,
            mapPayload.width,
            mapPayload.height
          );
          worldX = spawn.tileX * TILE_SIZE + TILE_SIZE / 2;
          worldY = (spawn.tileY + 1) * TILE_SIZE;
          console.log(
            `[ChunkRoom] Spawn computed: tile(${spawn.tileX},${spawn.tileY}) -> pixel(${worldX},${worldY})`
          );
        } catch {
          console.warn(
            `[ChunkRoom] findSpawnTile failed, using DEFAULT_SPAWN: userId=${userId}`
          );
          worldX = DEFAULT_SPAWN.worldX;
          worldY = DEFAULT_SPAWN.worldY;
        }
      } else {
        worldX = DEFAULT_SPAWN.worldX;
        worldY = DEFAULT_SPAWN.worldY;
      }

    }

    // Always include spawn position in map payload (both new and returning players)
    mapPayload.spawnX = worldX;
    mapPayload.spawnY = worldY;
    mapPayload.spawnDirection = direction as
      | 'up'
      | 'down'
      | 'left'
      | 'right';

    // 6. Create server player
    const serverPlayer = createServerPlayer({
      id: client.sessionId,
      userId,
      worldX,
      worldY,
      chunkId,
      direction: direction as 'up' | 'down' | 'left' | 'right',
      skin: AVAILABLE_SKINS[
        Math.floor(Math.random() * AVAILABLE_SKINS.length)
      ],
      name: auth.email.split('@')[0],
    });

    // Register in World
    world.addPlayer(serverPlayer);

    // Mirror to schema
    const chunkPlayer = new ChunkPlayer();
    chunkPlayer.id = client.sessionId;
    chunkPlayer.worldX = worldX;
    chunkPlayer.worldY = worldY;
    chunkPlayer.direction = direction;
    chunkPlayer.skin = serverPlayer.skin;
    chunkPlayer.name = serverPlayer.name;
    this.state.players.set(client.sessionId, chunkPlayer);

    // Register session for duplicate detection
    sessionTracker.register(userId, client, this);

    // 7. Send map data to client
    client.send(ServerMessage.MAP_DATA, mapPayload);
    console.log(`[ChunkRoom] MAP_DATA sent: userId=${userId}, mapId=${mapId}`);

    console.log(
      `[ChunkRoom] Player joined: sessionId=${client.sessionId}, userId=${userId}, chunk=${this.chunkId}`
    );

    // ── Bot spawn/load (all maps are homesteads) ───────────────────────────────
    if (
      this.mapWalkable.length > 0 &&
      this.state.bots.size === 0 &&
      !this.botInitInProgress
    ) {
      this.botInitInProgress = true;

      const botConfig = {
        ...this.getMapConfig(),
        mapId,
        tickIntervalMs: PATCH_RATE_MS,
      };

      try {
        const existingBots = await loadBots(db, mapId);
        this.botManager.init(botConfig, existingBots);

        if (existingBots.length > 0) {
          // Returning player: restore bots from DB
          for (const bot of existingBots) {
            this.addBotToState(bot);
          }
          console.log(
            `[ChunkRoom] Bots loaded from DB: ${existingBots.length}`
          );
        } else {
          // First visit: generate bots near player spawn
          const generated = this.botManager.generateBots(
            DEFAULT_BOT_COUNT,
            worldX,
            worldY
          );

          for (const gen of generated) {
            try {
              const record = await createBot(db, {
                mapId,
                name: gen.name,
                skin: gen.skin,
                worldX: gen.worldX,
                worldY: gen.worldY,
                direction: 'down',
              });
              this.botManager.addBot(record);
              this.addBotToState(record);
            } catch (createErr) {
              console.error(
                '[ChunkRoom] Failed to persist bot:',
                createErr
              );
            }
          }
        }
      } catch (err) {
        // DB errors must not block player join
        console.error(
          '[ChunkRoom] Failed to load bots, continuing without:',
          err
        );
      } finally {
        this.botInitInProgress = false;
      }
    }
  }

  override async onLeave(client: Client, _code?: number): Promise<void> {
    // Clean up dialogue session if active
    if (this.dialogueSessions.has(client.sessionId)) {
      this.handleDialogueEnd(client, 'leave');
    }

    const player = world.getPlayer(client.sessionId);

    console.log(
      `[ChunkRoom] onLeave fired: sessionId=${client.sessionId}, code=${_code}, playerFound=${!!player}`
    );

    if (player) {
      console.log(
        `[ChunkRoom] onLeave saving position: userId=${player.userId}, worldX=${player.worldX}, worldY=${player.worldY}, chunkId=${player.chunkId}, direction=${player.direction}`
      );

      // Unregister session
      sessionTracker.unregister(player.userId);

      // Save position to DB
      try {
        const db = getGameDb();
        await savePosition(db, {
          userId: player.userId,
          worldX: player.worldX,
          worldY: player.worldY,
          chunkId: player.chunkId,
          direction: player.direction,
        });
        console.log(
          `[ChunkRoom] onLeave position saved OK: userId=${player.userId}`
        );
      } catch (error) {
        console.error(
          `[ChunkRoom] onLeave position save FAILED: userId=${player.userId}`,
          error
        );
      }

      // Remove from World
      world.removePlayer(client.sessionId);
    } else {
      console.warn(
        `[ChunkRoom] onLeave: player NOT found in World for sessionId=${client.sessionId} — position NOT saved`
      );
    }

    // Remove from schema
    this.state.players.delete(client.sessionId);

    // ── Bot despawn: save positions when last player leaves ────────────────────
    // Use state.players.size (already decremented above) instead of this.clients.length
    // which may still include the departing client during Colyseus onLeave.
    if (this.state.players.size === 0 && this.state.bots.size > 0) {
      const positions = this.botManager.getBotPositions();
      if (positions.length > 0) {
        try {
          const db = getGameDb();
          await saveBotPositions(db, positions);
          console.log(
            `[ChunkRoom] Bot positions saved: ${positions.length}`
          );
        } catch (err) {
          console.error(
            '[ChunkRoom] Failed to save bot positions:',
            err
          );
        }
      }

      // Clear bots from Colyseus state
      for (const botId of this.botManager.getBotIds()) {
        this.state.bots.delete(botId);
      }
      this.botManager.destroy();
    }

    console.log(
      `[ChunkRoom] Player left: sessionId=${client.sessionId}, chunk=${this.chunkId}`
    );
  }

  override onDispose(): void {
    // Abort all in-flight AI streams and clean up DB sessions
    for (const [sessionId, session] of this.dialogueSessions) {
      session.abortController?.abort();

      const db = getGameDb();
      endDialogueSession(db, session.dbSessionId).catch((err: unknown) => {
        console.error(
          `[ChunkRoom] onDispose: failed to end session: dbSessionId=${session.dbSessionId}`,
          err
        );
      });

      this.botManager.endInteraction(session.botId, sessionId);

      console.log(
        `[ChunkRoom] Dialogue ended: sessionId=${sessionId}, botId=${session.botId}, reason=leave`
      );
    }
    this.dialogueSessions.clear();

    if (this.positionSaveTimer) {
      clearInterval(this.positionSaveTimer);
      this.positionSaveTimer = null;
    }
    this.botManager.destroy();
    chunkManager.unregisterRoom(this.chunkId);
    console.log(`[ChunkRoom] Room disposed: chunk:${this.chunkId}`);
  }

  private async handleDialogueMessage(client: Client, payload: unknown): Promise<void> {
    const session = this.dialogueSessions.get(client.sessionId);
    if (!session) {
      return;
    }

    // Validate payload
    if (
      typeof payload !== 'object' ||
      payload === null ||
      typeof (payload as DialogueMessagePayload).text !== 'string' ||
      (payload as DialogueMessagePayload).text.trim() === ''
    ) {
      return;
    }

    const { text } = payload as DialogueMessagePayload;
    console.log(
      `[ChunkRoom] Dialogue message: sessionId=${client.sessionId}, text=${text.slice(0, 50)}`
    );

    // Abort any in-flight stream
    session.abortController?.abort();

    const db = getGameDb();

    // Save user message (fire-and-forget)
    addDialogueMessage(db, {
      sessionId: session.dbSessionId,
      role: 'user',
      content: text,
    }).catch((err: unknown) => {
      console.error(
        `[ChunkRoom] Failed to save user message: sessionId=${client.sessionId}`,
        err
      );
    });

    // Load conversation history (fail gracefully -- empty array on error)
    let conversationHistory: Array<{ role: string; content: string }> = [];
    const player = world.getPlayer(client.sessionId);
    if (player?.userId) {
      try {
        conversationHistory = await getRecentDialogueHistory(
          db,
          session.botId,
          player.userId,
          20
        );
      } catch (err) {
        console.error(
          `[ChunkRoom] Failed to load dialogue history: sessionId=${client.sessionId}`,
          err
        );
      }
    }

    // Create AbortController for this stream
    const abortController = new AbortController();
    session.abortController = abortController;

    // Get bot name from state
    const botSchema = this.state.bots.get(session.botId);
    const botName = botSchema?.name ?? 'NPC';

    // Stream AI response
    let fullText = '';
    try {
      const stream = this.dialogueService!.streamResponse({
        botName,
        persona: session.persona,
        playerText: text,
        conversationHistory,
        abortSignal: abortController.signal,
      });

      for await (const chunk of stream) {
        client.send(ServerMessage.DIALOGUE_STREAM_CHUNK, { text: chunk });
        fullText += chunk;
      }
    } catch (err) {
      console.error(
        `[ChunkRoom] Stream error: sessionId=${client.sessionId}`,
        err
      );
    }

    // Send end-of-turn marker
    client.send(ServerMessage.DIALOGUE_END_TURN, {});

    // Clear abort controller
    session.abortController = null;

    // Save assistant message (fire-and-forget)
    if (fullText.length > 0) {
      addDialogueMessage(db, {
        sessionId: session.dbSessionId,
        role: 'assistant',
        content: fullText,
      }).catch((err: unknown) => {
        console.error(
          `[ChunkRoom] Failed to save assistant message: sessionId=${client.sessionId}`,
          err
        );
      });
    }
  }

  private handleDialogueEnd(client: Client, reason: string): void {
    const session = this.dialogueSessions.get(client.sessionId);
    if (!session) {
      return;
    }

    // Abort any in-flight AI stream
    session.abortController?.abort();

    // End DB session (fire-and-forget)
    const db = getGameDb();
    endDialogueSession(db, session.dbSessionId).catch((err: unknown) => {
      console.error(
        `[ChunkRoom] Failed to end dialogue session: dbSessionId=${session.dbSessionId}`,
        err
      );
    });

    // End interaction in BotManager
    this.botManager.endInteraction(session.botId, client.sessionId);

    // Sync bot state back to idle in Colyseus schema
    const botSchema = this.state.bots.get(session.botId);
    if (botSchema) {
      botSchema.state = 'idle';
    }

    console.log(
      `[ChunkRoom] Dialogue ended: sessionId=${client.sessionId}, botId=${session.botId}, reason=${reason}`
    );

    // Remove session
    this.dialogueSessions.delete(client.sessionId);
  }

  private handleMove(client: Client, payload: unknown): void {
    // Reject movement during dialogue
    if (this.dialogueSessions.has(client.sessionId)) {
      return;
    }

    if (
      !payload ||
      typeof payload !== 'object' ||
      typeof (payload as MovePayload).dx !== 'number' ||
      typeof (payload as MovePayload).dy !== 'number'
    ) {
      console.warn(
        `[ChunkRoom] Invalid move payload from sessionId=${client.sessionId}`
      );
      return;
    }

    const move = payload as MovePayload;
    const result = world.movePlayer(client.sessionId, move.dx, move.dy);

    // Update schema (triggers Colyseus auto-patch = move-ack)
    const chunkPlayer = this.state.players.get(client.sessionId);
    if (chunkPlayer) {
      chunkPlayer.worldX = result.worldX;
      chunkPlayer.worldY = result.worldY;
      const worldPlayer = world.getPlayer(client.sessionId);
      if (worldPlayer) {
        chunkPlayer.direction = worldPlayer.direction;
      }
    }

    // Handle chunk transition
    if (result.chunkChanged && result.newChunkId) {
      if (chunkManager.canTransition(client.sessionId)) {
        chunkManager.recordTransition(client.sessionId);

        const transitionPayload: ChunkTransitionPayload = {
          newChunkId: result.newChunkId,
        };
        client.send(ServerMessage.CHUNK_TRANSITION, transitionPayload);

        console.log(
          `[ChunkRoom] Chunk transition: sessionId=${client.sessionId}, ${result.oldChunkId} -> ${result.newChunkId}`
        );
      }
    }
  }

  private handlePositionUpdate(client: Client, payload: unknown): void {
    if (
      !payload ||
      typeof payload !== 'object' ||
      typeof (payload as PositionUpdatePayload).x !== 'number' ||
      typeof (payload as PositionUpdatePayload).y !== 'number'
    ) {
      return;
    }

    const { x, y } = payload as PositionUpdatePayload;

    if (!world.setPlayerPosition(client.sessionId, x, y)) {
      return;
    }

    // Update schema so Colyseus patches reach other clients
    const chunkPlayer = this.state.players.get(client.sessionId);
    if (chunkPlayer) {
      chunkPlayer.worldX = x;
      chunkPlayer.worldY = y;
    }
  }

  private async handleNpcInteract(client: Client, payload: unknown): Promise<void> {
    // No bots loaded in this room
    if (this.state.bots.size === 0) {
      client.send(ServerMessage.NPC_INTERACT_RESULT, {
        success: false,
        error: 'No NPCs in this area',
      });
      return;
    }

    // Validate payload shape
    if (
      typeof payload !== 'object' ||
      payload === null ||
      typeof (payload as Record<string, unknown>)['botId'] !== 'string'
    ) {
      client.send(ServerMessage.NPC_INTERACT_RESULT, {
        success: false,
        error: 'Invalid payload',
      });
      return;
    }

    const { botId } = payload as { botId: string };

    // Get player's current position from Colyseus state
    const player = this.state.players.get(client.sessionId);
    if (!player) {
      client.send(ServerMessage.NPC_INTERACT_RESULT, {
        success: false,
        error: 'Player not found',
      });
      return;
    }

    const result = this.botManager.validateInteraction(
      botId,
      player.worldX,
      player.worldY
    );

    if (result.success) {
      // Start dialogue interaction
      const started = this.botManager.startInteraction(
        botId,
        client.sessionId
      );
      if (!started) {
        client.send(ServerMessage.NPC_INTERACT_RESULT, {
          success: false,
          error: 'Bot is busy',
        });
        return;
      }

      // Create DB dialogue session (fail-fast)
      let dbSessionId: string;
      try {
        const db = getGameDb();
        const userId = (client.auth as AuthData)?.userId;
        const dbSession = await createDialogueSession(db, {
          botId,
          userId: userId,
        });
        dbSessionId = dbSession.id;
      } catch (err) {
        console.error(
          `[ChunkRoom] Failed to create dialogue session: botId=${botId}, sessionId=${client.sessionId}`,
          err
        );
        // Rollback: release bot from interaction
        this.botManager.endInteraction(botId, client.sessionId);
        client.send(ServerMessage.NPC_INTERACT_RESULT, {
          success: false,
          error: 'Failed to initialize dialogue',
        });
        return;
      }

      // Cache persona from bot record (null for MVP; persona seeding is a separate task)
      const persona = null;

      // Track dialogue session
      this.dialogueSessions.set(client.sessionId, {
        botId,
        dbSessionId,
        abortController: null,
        persona,
      });

      console.log(
        `[ChunkRoom] Dialogue session created: sessionId=${client.sessionId}, botId=${botId}, dbSessionId=${dbSessionId}`
      );

      // Sync bot state to Colyseus schema
      const botSchema = this.state.bots.get(botId);
      if (botSchema) {
        botSchema.state = 'interacting';
      }

      // Send dialogue start to client
      const startPayload: DialogueStartPayload = {
        botId,
        botName: result.name,
      };
      client.send(ServerMessage.DIALOGUE_START, startPayload);

      // Send interact result with dialogueStarted flag
      client.send(ServerMessage.NPC_INTERACT_RESULT, {
        success: true,
        bot: {
          id: result.botId,
          name: result.name,
          state: result.state,
        },
        dialogueStarted: true,
      });
    } else {
      client.send(ServerMessage.NPC_INTERACT_RESULT, {
        success: false,
        error: result.error,
      });
    }
  }

  private handleHardReset(client: Client): void {
    if (this.mapWalkable.length === 0 || !this.mapGrid) {
      client.send(ServerMessage.ERROR, { message: 'Map not loaded' });
      return;
    }

    const mapHeight = this.mapWalkable.length;
    const mapWidth = this.mapWalkable[0]?.length ?? 0;

    let spawnX: number;
    let spawnY: number;

    try {
      const spawn = findSpawnTile(
        this.mapWalkable,
        this.mapGrid,
        mapWidth,
        mapHeight
      );
      spawnX = spawn.tileX * TILE_SIZE + TILE_SIZE / 2;
      spawnY = (spawn.tileY + 1) * TILE_SIZE;
    } catch {
      spawnX = DEFAULT_SPAWN.worldX;
      spawnY = DEFAULT_SPAWN.worldY;
    }

    world.setPlayerPosition(client.sessionId, spawnX, spawnY);

    const chunkPlayer = this.state.players.get(client.sessionId);
    if (chunkPlayer) {
      chunkPlayer.worldX = spawnX;
      chunkPlayer.worldY = spawnY;
    }

    console.log(
      `[ChunkRoom] Hard reset: sessionId=${client.sessionId}, teleported to (${spawnX}, ${spawnY})`
    );
  }

  /**
   * Returns the current map walkability config for BotManager initialization.
   * Reads from the class field populated during onJoin map loading.
   */
  private getMapConfig(): {
    mapWalkable: boolean[][];
    mapWidth: number;
    mapHeight: number;
  } {
    const mapHeight = this.mapWalkable.length;
    const mapWidth = this.mapWalkable[0]?.length ?? 0;

    if (mapHeight === 0 || mapWidth === 0) {
      console.error(
        `[ChunkRoom] getMapConfig: walkable grid is empty (${mapWidth}x${mapHeight}). Bots will not be able to move.`
      );
    }

    return { mapWalkable: this.mapWalkable, mapWidth, mapHeight };
  }

  /**
   * Save positions for all players currently in this room.
   * Called periodically and can be called on-demand.
   */
  private saveAllPlayerPositions(): void {
    if (this.state.players.size === 0) return;

    const db = getGameDb();
    const count = this.state.players.size;

    console.log(
      `[ChunkRoom] Autosave: saving ${count} player position(s), chunk=${this.chunkId}`
    );

    this.state.players.forEach((_chunkPlayer, sessionId) => {
      const player = world.getPlayer(sessionId);
      if (!player) return;

      console.log(
        `[ChunkRoom] Autosave: userId=${player.userId}, x=${player.worldX.toFixed(1)}, y=${player.worldY.toFixed(1)}, dir=${player.direction}`
      );

      savePosition(db, {
        userId: player.userId,
        worldX: player.worldX,
        worldY: player.worldY,
        chunkId: player.chunkId,
        direction: player.direction,
      }).catch((err: unknown) => {
        console.error(
          `[ChunkRoom] Autosave position FAILED: userId=${player.userId}`,
          err
        );
      });
    });
  }

  /**
   * Add a single bot record to state.bots as a ChunkBot schema instance.
   */
  private addBotToState(bot: {
    id: string;
    mapId: string;
    name: string;
    skin: string;
    worldX: number;
    worldY: number;
    direction: string;
  }): void {
    const schema = new ChunkBot();
    schema.id = bot.id;
    schema.mapId = bot.mapId;
    schema.name = bot.name;
    schema.skin = bot.skin;
    schema.worldX = bot.worldX;
    schema.worldY = bot.worldY;
    schema.direction = bot.direction;
    schema.state = 'idle';
    this.state.bots.set(bot.id, schema);
  }
}
