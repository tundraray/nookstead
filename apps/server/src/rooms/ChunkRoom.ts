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
  saveMap,
  loadMap,
  getPublishedTemplates,
  getGameObject,
  loadBots,
  saveBotPositions,
  createBot,
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
  type AuthData,
  type ChunkTransitionPayload,
  type MapDataPayload,
  type Grid,
  type SerializedLayer,
  type CollisionZoneDef,
} from '@nookstead/shared';
import { applyObjectCollisionZones } from '@nookstead/map-lib';

export class ChunkRoom extends Room<{ state: ChunkRoomState }> {
  private chunkId!: string;
  private botManager = new BotManager();
  private homesteadMapId: string | null = null;
  private mapWalkable: boolean[][] = [];
  private botInitInProgress = false;

  override onCreate(options: Record<string, unknown>): void {
    this.chunkId =
      typeof options?.['chunkId'] === 'string'
        ? options['chunkId']
        : 'city:capital';
    this.setState(new ChunkRoomState());
    this.setPatchRate(PATCH_RATE_MS);

    // Register with ChunkManager
    chunkManager.registerRoom(this.chunkId, this);

    // Message handlers
    this.onMessage(ClientMessage.MOVE, (client, payload: unknown) => {
      this.handleMove(client as Client, payload);
    });

    this.onMessage(ClientMessage.NPC_INTERACT, (client, payload: unknown) => {
      this.handleNpcInteract(client as Client, payload);
    });

    // Bot simulation tick (100ms interval, matching PATCH_RATE_MS)
    this.setSimulationInterval((deltaTime) => {
      if (this.homesteadMapId === null) return;
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

    // 2. Redirect if player belongs in a different chunk
    const targetChunkId = savedPosition?.chunkId ?? `player:${userId}`;

    if (targetChunkId !== this.chunkId) {
      console.log(
        `[ChunkRoom] Redirecting: userId=${userId}, from=${this.chunkId} to=${targetChunkId}`
      );
      client.send(ServerMessage.ROOM_REDIRECT, { chunkId: targetChunkId });
      return;
    }

    // 3. Load or generate map
    let mapPayload: MapDataPayload;
    let mapWalkable: boolean[][] | null = null;
    let mapGrid: Grid | null = null;

    try {
      // Attempt to load saved map (non-fatal if DB table missing or query fails)
      let savedMap = null;
      try {
        savedMap = await loadMap(db, userId);
      } catch (loadErr) {
        console.warn(
          `[ChunkRoom] Map load failed (will generate new): userId=${userId}`,
          loadErr
        );
      }

      if (savedMap) {
        // Returning player: use saved map
        console.log(`[ChunkRoom] Map loaded from DB: userId=${userId}`);
        mapWalkable = savedMap.walkable as boolean[][];
        mapGrid = savedMap.grid as unknown as Grid;
        mapPayload = {
          seed: savedMap.seed,
          width: savedMap.width,
          height: savedMap.height,
          grid: savedMap.grid as MapDataPayload['grid'],
          layers: savedMap.layers as MapDataPayload['layers'],
          walkable: mapWalkable,
        };
      } else {
        // New player or load failed: pick random published template
        const templates = await getPublishedTemplates(
          db,
          'player_homestead'
        );

        if (templates.length === 0) {
          client.send(ServerMessage.ERROR, {
            message: 'No published template maps available',
          });
          return;
        }

        const template =
          templates[Math.floor(Math.random() * templates.length)];
        const seed = Math.floor(Math.random() * 0x7fffffff);

        console.log(
          `[ChunkRoom] Assigning published template for new player: userId=${userId}, templateId=${template.id}, seed=${seed}`
        );

        mapWalkable = (template.walkable as boolean[][]) ?? [];
        mapGrid = template.grid as unknown as Grid;
        mapPayload = {
          seed,
          width: template.baseWidth,
          height: template.baseHeight,
          grid: template.grid as MapDataPayload['grid'],
          layers: template.layers as MapDataPayload['layers'],
          walkable: mapWalkable,
        };

        // Save to DB (fire and forget with error logging)
        saveMap(db, {
          userId,
          seed,
          width: template.baseWidth,
          height: template.baseHeight,
          grid: template.grid,
          layers: template.layers,
          walkable: template.walkable,
        }).catch((err: unknown) => {
          console.error(
            `[ChunkRoom] Map save failed (non-fatal): userId=${userId}`,
            err
          );
        });
      }
    } catch (err) {
      console.error(
        `[ChunkRoom] Map generation failed: userId=${userId}`,
        err
      );
      client.send(ServerMessage.ERROR, { message: 'Map data unavailable' });
      return;
    }

    // 3b. Apply object collision zones to walkability grid
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
            `[ChunkRoom] Object collision zones applied: userId=${userId}, objects=${placedObjects.length}, definitions=${objectDefinitions.size}`
          );
        }
      } catch (err) {
        console.warn(
          `[ChunkRoom] Object collision zone application failed (non-fatal): userId=${userId}`,
          err
        );
      }
    }

    // Store walkable grid for bot manager access
    if (mapWalkable) {
      this.mapWalkable = mapWalkable;
    }

    // 3. Determine spawn position
    let worldX: number;
    let worldY: number;
    let chunkId: string;
    let direction: string;

    if (savedPosition) {
      worldX = savedPosition.worldX;
      worldY = savedPosition.worldY;
      chunkId = savedPosition.chunkId;
      direction = savedPosition.direction;
    } else {
      // New player: use this room's chunkId (after redirect, this IS the correct chunk)
      chunkId = this.chunkId;
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

      // Include spawn position in map payload for new players
      mapPayload.spawnX = worldX;
      mapPayload.spawnY = worldY;
    }

    // 4. Create server player
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

    // 5. Send map data to client
    client.send(ServerMessage.MAP_DATA, mapPayload);
    console.log(`[ChunkRoom] MAP_DATA sent: userId=${userId}`);

    console.log(
      `[ChunkRoom] Player joined: sessionId=${client.sessionId}, userId=${userId}, chunk=${this.chunkId}`
    );

    // ── Bot spawn/load for homestead rooms ─────────────────────────────────────
    if (
      this.chunkId.startsWith('player:') &&
      this.state.bots.size === 0 &&
      !this.botInitInProgress
    ) {
      this.botInitInProgress = true;
      const mapId = userId;
      this.homesteadMapId = mapId;

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
    const player = world.getPlayer(client.sessionId);
    if (player) {
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
          `[ChunkRoom] Position saved: userId=${player.userId}, worldX=${player.worldX}, worldY=${player.worldY}`
        );
      } catch (error) {
        console.error(
          `[ChunkRoom] Position save failed: userId=${player.userId}`,
          error
        );
      }

      // Remove from World
      world.removePlayer(client.sessionId);
    }

    // Remove from schema
    this.state.players.delete(client.sessionId);

    // ── Bot despawn: save positions when last player leaves ────────────────────
    // Use state.players.size (already decremented above) instead of this.clients.length
    // which may still include the departing client during Colyseus onLeave.
    if (this.state.players.size === 0 && this.homesteadMapId !== null) {
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
      this.homesteadMapId = null;
    }

    console.log(
      `[ChunkRoom] Player left: sessionId=${client.sessionId}, chunk=${this.chunkId}`
    );
  }

  override onDispose(): void {
    this.botManager.destroy();
    chunkManager.unregisterRoom(this.chunkId);
    console.log(`[ChunkRoom] Room disposed: chunk:${this.chunkId}`);
  }

  private handleMove(client: Client, payload: unknown): void {
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

    // Map walkability collision (includes terrain and game object zones)
    if (this.mapWalkable.length > 0) {
      const tileX = Math.floor(result.worldX / TILE_SIZE);
      const tileY = Math.floor(result.worldY / TILE_SIZE);
      const isWalkable = this.mapWalkable[tileY]?.[tileX] === true;
      if (!isWalkable) {
        // Rollback: move back by applying negative delta
        world.movePlayer(client.sessionId, -move.dx, -move.dy);
        return;
      }
    }

    // Bot collision: check if new position overlaps a bot tile (homestead only)
    if (
      this.homesteadMapId !== null &&
      this.botManager.isTileOccupiedByBot(result.worldX, result.worldY)
    ) {
      // Rollback: move back by applying negative delta
      world.movePlayer(client.sessionId, -move.dx, -move.dy);
      // Do not update player schema — position stays unchanged
      return;
    }

    // Update schema (triggers Colyseus auto-patch = move-ack)
    const chunkPlayer = this.state.players.get(client.sessionId);
    if (chunkPlayer) {
      chunkPlayer.worldX = result.worldX;
      chunkPlayer.worldY = result.worldY;
      // Also update direction from the world player
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

  private handleNpcInteract(client: Client, payload: unknown): void {
    if (this.homesteadMapId === null) {
      client.send(ServerMessage.NPC_INTERACT_RESULT, {
        success: false,
        error: 'NPC interaction not available in this area',
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
      client.send(ServerMessage.NPC_INTERACT_RESULT, {
        success: true,
        bot: {
          id: result.botId,
          name: result.name,
          state: result.state,
        },
      });
    } else {
      client.send(ServerMessage.NPC_INTERACT_RESULT, {
        success: false,
        error: result.error,
      });
    }
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
