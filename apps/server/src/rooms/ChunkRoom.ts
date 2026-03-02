import { Room, Client, type AuthContext } from 'colyseus';
import { ChunkRoomState, ChunkPlayer } from './ChunkRoomState';
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
} from '@nookstead/db';
import {
  PATCH_RATE_MS,
  AVAILABLE_SKINS,
  DEFAULT_SPAWN,
  TILE_SIZE,
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

    // 2. Determine target chunkId and mapId
    let targetChunkId: string;
    let mapId: string | null = null;

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

    // 4. Load map data
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
      const savedMap = await loadMap(db, mapId);

      if (savedMap) {
        console.log(
          `[ChunkRoom] Map loaded from DB: mapId=${mapId}`
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

    console.log(
      `[ChunkRoom] Player left: sessionId=${client.sessionId}, chunk=${this.chunkId}`
    );
  }

  override onDispose(): void {
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

    // DEBUG: verify MOVE messages are being processed
    const wp = world.getPlayer(client.sessionId);
    console.log(
      `[ChunkRoom][DEBUG] MOVE dx=${move.dx.toFixed(2)} dy=${move.dy.toFixed(2)} -> worldX=${result.worldX.toFixed(1)} worldY=${result.worldY.toFixed(1)} chunkId=${wp?.chunkId}`
    );

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
}
