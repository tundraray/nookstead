import { Scene } from 'phaser';
import { EventBus } from '../EventBus';
import { TILE_SIZE, FRAME_SIZE, MAP_WIDTH, MAP_HEIGHT, CLICK_THRESHOLD, FENCE_LAYER_DEPTH } from '../constants';
import {
  EMPTY_FRAME,
  generateFenceTileset,
  getGateFrameIndex,
  GATE_BITMASK_NS,
  GATE_BITMASK_EW,
  updateCellWalkability,
} from '@nookstead/map-lib';
import type { FrameImageSource, FenceLayerSnapshot } from '@nookstead/map-lib';
import type {
  MapDataPayload,
  GeneratedMap,
  SerializedFenceLayer,
  FenceCellData,
} from '@nookstead/shared';
import type { Room } from '@colyseus/sdk';
import { PlayerManager } from '../multiplayer/PlayerManager';
import { Player } from '../entities/Player';
import { findSpawnTile } from '../systems/spawn';

/**
 * Atlas frame coordinates resolved from the fence-types API.
 * Matches the ResolvedFrame shape returned by GET /api/fence-types/by-key/[key].
 */
export interface ResolvedFrame {
  atlasFrameId: string;
  spriteId: string;
  frameX: number;
  frameY: number;
  frameW: number;
  frameH: number;
}

/**
 * Fence type definition as returned by the fence-types API.
 * Contains resolved atlas frame coordinates for all 16 connection states
 * and 4 gate variants.
 */
export interface FenceTypeDefinition {
  id: string;
  key: string;
  name: string;
  category: string;
  frameMapping: Record<string, ResolvedFrame>;
  gateFrameMapping: Record<string, ResolvedFrame> | null;
  sortOrder: number;
}

/**
 * Result of loading and processing fence layers from MapDataPayload.
 * Stored on the Game scene for use by the fence renderer (Task 5B).
 */
export interface LoadedFenceData {
  /** Parsed fence layers from the payload (empty array if none). */
  layers: SerializedFenceLayer[];
  /** Fence type definitions keyed by fenceTypeKey. */
  fenceTypes: Map<string, FenceTypeDefinition>;
}

/**
 * Registered gate position for runtime interaction (Task 5C).
 * Collected during fence layer rendering and stored on the scene instance.
 */
export interface GatePosition {
  /** Tile X coordinate */
  x: number;
  /** Tile Y coordinate */
  y: number;
  /** Fence type key for visual lookups */
  fenceTypeKey: string;
  /** Current open/closed state */
  open: boolean;
  /** True if gate is in a north-south corridor (bitmask 5), false for east-west (bitmask 10) */
  isNS: boolean;
}

/**
 * Sprite record with a signed S3 URL, returned by GET /api/sprites/{id}.
 */
interface SpriteRecord {
  id: string;
  s3Url: string;
}

/**
 * Base URL for fence type API requests.
 * In production this should point to the API server that hosts the
 * fence-types endpoints. Uses NEXT_PUBLIC_FENCE_API_URL env var
 * with a fallback to the same origin (relative URL).
 */
const FENCE_API_BASE_URL: string =
  (typeof process !== 'undefined' &&
    process.env?.['NEXT_PUBLIC_FENCE_API_URL']) ||
  '';

export class Game extends Scene {
  private mapData: GeneratedMap | null = null;
  private rt!: Phaser.GameObjects.RenderTexture;
  private hover!: Phaser.GameObjects.Graphics;
  private playerManager!: PlayerManager;
  private player!: Player;
  private room: Room | null = null;
  private serverSpawnX: number | undefined;
  private serverSpawnY: number | undefined;

  /**
   * Loaded fence layer data for the current map.
   * Populated during create() and consumed by the fence renderer.
   * Null until fence loading completes (or if no fence layers exist).
   */
  fenceData: LoadedFenceData | null = null;

  /**
   * RenderTexture for fence layers, rendered above terrain (depth 0.5).
   * Null until fence rendering completes.
   */
  private fenceRt: Phaser.GameObjects.RenderTexture | null = null;

  /**
   * Gate positions registered during fence layer rendering.
   * Consumed by the interaction system (Task 5C).
   */
  gatePositions: GatePosition[] = [];

  /**
   * Persistent stamp sprite for re-stamping individual fence tiles
   * (e.g., after a gate toggle). Created during renderFenceLayers().
   */
  private fenceStamp: Phaser.GameObjects.Sprite | null = null;

  /**
   * Terrain-only walkability grid snapshot, taken before fence layers
   * modify walkability. Used as the base layer for incremental
   * walkability updates when gate state changes.
   */
  private terrainWalkable: boolean[][] = [];

  /**
   * Fence layer cell snapshots for walkability computation.
   * Built from SerializedFenceLayer data during renderFenceLayers().
   * Gate cell states are updated in place when the server confirms a toggle.
   */
  private fenceLayerSnapshots: FenceLayerSnapshot[] = [];

  /**
   * E key for interacting with gates and other interactable objects.
   */
  private interactKey: Phaser.Input.Keyboard.Key | null = null;

  constructor() {
    super('Game');
  }

  /** Raw fence layers from MapDataPayload, preserved for async loading. */
  private rawFenceLayers: SerializedFenceLayer[] = [];

  /**
   * Called by Phaser before create() with data from scene.start().
   * Receives mapData and room from LoadingScene.
   */
  init(data: { mapData: MapDataPayload; room?: Room }): void {
    // Cast MapDataPayload to GeneratedMap at the network boundary.
    // The structures are identical at runtime; the server generates
    // map data using the same pipeline. The only type-level difference
    // is SerializedCell.terrain (string) vs Cell.terrain (TerrainCellType).
    this.mapData = data.mapData as unknown as GeneratedMap;
    this.room = data.room ?? null;
    this.serverSpawnX = data.mapData.spawnX;
    this.serverSpawnY = data.mapData.spawnY;

    this.rawFenceLayers = data.mapData.fenceLayers;
  }

  create() {
    if (!this.mapData) {
      console.error('[Game] No mapData received from LoadingScene!');
      return;
    }

    const mapPixelW = MAP_WIDTH * TILE_SIZE;
    const mapPixelH = MAP_HEIGHT * TILE_SIZE;

    const tileScale = TILE_SIZE / FRAME_SIZE;

    // Render all layers to a single RenderTexture.
    this.rt = this.add.renderTexture(0, 0, mapPixelW, mapPixelH);
    const rt = this.rt;
    rt.setOrigin(0, 0);

    const stamp = this.add.sprite(0, 0, '').setScale(tileScale).setOrigin(0, 0).setVisible(false);

    for (const layerData of this.mapData.layers) {
      for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
          const frame = layerData.frames[y][x];
          if (frame === EMPTY_FRAME) continue;

          stamp.setTexture(layerData.terrainKey, frame);
          rt.draw(stamp, x * TILE_SIZE, y * TILE_SIZE);
        }
      }
    }
    stamp.destroy();

    // Determine spawn position: prefer server-computed, fall back to client-side
    let spawnX: number;
    let spawnY: number;
    if (this.serverSpawnX != null && this.serverSpawnY != null) {
      spawnX = this.serverSpawnX;
      spawnY = this.serverSpawnY;
    } else {
      const spawn = findSpawnTile(
        this.mapData.walkable,
        this.mapData.grid,
        MAP_WIDTH,
        MAP_HEIGHT,
      );
      spawnX = spawn.tileX * TILE_SIZE + TILE_SIZE / 2;
      spawnY = (spawn.tileY + 1) * TILE_SIZE;
    }
    this.player = new Player(this, spawnX, spawnY, this.mapData);

    // Camera: follow player with lerp smoothing, bounded by map
    const cam = this.cameras.main;
    cam.setBackgroundColor(0x215c81);
    cam.setBounds(0, 0, mapPixelW, mapPixelH);
    cam.startFollow(this.player, true, 0.1, 0.1);
    cam.setZoom(2);

    // Tile hover highlight
    this.hover = this.add.graphics();
    this.hover.setDepth(1);
    let prevTileX = -1;
    let prevTileY = -1;

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      const tileX = Math.floor(pointer.worldX / TILE_SIZE);
      const tileY = Math.floor(pointer.worldY / TILE_SIZE);

      if (tileX === prevTileX && tileY === prevTileY) return;
      prevTileX = tileX;
      prevTileY = tileY;

      this.hover.clear();
      if (tileX < 0 || tileX >= MAP_WIDTH || tileY < 0 || tileY >= MAP_HEIGHT) return;

      this.hover.lineStyle(1, 0xffffff, 0.6);
      this.hover.fillStyle(0xffffff, 0.12);
      this.hover.fillRect(tileX * TILE_SIZE, tileY * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      this.hover.strokeRect(tileX * TILE_SIZE, tileY * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    });

    // Mouse wheel zoom
    this.input.on(
      'wheel',
      (
        _pointer: Phaser.Input.Pointer,
        _gameObjects: Phaser.GameObjects.GameObject[],
        _deltaX: number,
        deltaY: number,
      ) => {
        cam.zoom = Phaser.Math.Clamp(cam.zoom - deltaY * 0.001, 0.25, 4);
      },
    );

    // Click-to-move: track pointer down position to distinguish clicks from drags
    let pointerDownX = 0;
    let pointerDownY = 0;
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointerDownX = pointer.x;
      pointerDownY = pointer.y;
    });
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      const dx = pointer.x - pointerDownX;
      const dy = pointer.y - pointerDownY;
      if (Math.sqrt(dx * dx + dy * dy) > CLICK_THRESHOLD) return;

      const tileX = Math.floor(pointer.worldX / TILE_SIZE);
      const tileY = Math.floor(pointer.worldY / TILE_SIZE);
      if (tileX < 0 || tileX >= MAP_WIDTH || tileY < 0 || tileY >= MAP_HEIGHT) return;

      // Calculate pixel target (center of tile, bottom edge for feet alignment)
      const targetX = tileX * TILE_SIZE + TILE_SIZE / 2;
      const targetY = (tileY + 1) * TILE_SIZE;

      // Move local player toward the clicked tile
      this.player.setMoveTarget(targetX, targetY);
    });

    // Re-fit camera when the canvas resizes
    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      cam.setSize(gameSize.width, gameSize.height);
    });

    // Snapshot terrain-only walkability before fence layers can modify it.
    // This serves as the immutable base for incremental walkability updates
    // when gate state changes at runtime.
    this.terrainWalkable = this.mapData.walkable.map((row) => [...row]);

    // Register interaction key (E) for gate toggling and future interactables
    if (this.input.keyboard) {
      this.interactKey = this.input.keyboard.addKey('E');
    }

    // Multiplayer — reuse existing room from LoadingScene to avoid duplicate connection
    this.playerManager = new PlayerManager(this);
    this.playerManager.setLocalPlayer(this.player);
    this.playerManager.connect(this.room ?? undefined);

    // Register server confirmation handler for gate state changes.
    // The client does NOT toggle gates locally — it sends a request and
    // waits for the server to broadcast the confirmed state (authoritative model).
    this.registerGateStateHandler();

    // Load fence layers asynchronously. This does not block terrain rendering
    // or player setup. Once loading completes, sprite images are fetched,
    // virtual tilesets are generated, and fence layers are rendered.
    this.loadFenceLayers(this.rawFenceLayers).then(async (data) => {
      this.fenceData = data;
      if (data.layers.length > 0) {
        console.log(
          `[Game] Loaded ${data.layers.length} fence layer(s) with ${data.fenceTypes.size} fence type(s)`
        );
        await this.renderFenceLayers(data);
      }
    });

    EventBus.emit('current-scene-ready', this);
  }

  /**
   * Load and process fence layers from the map payload.
   *
   * Extracts unique fence type keys, fetches their definitions from the API,
   * and returns the parsed data for the fence renderer.
   *
   * Graceful degradation: if a fence type fetch fails (404 or network error),
   * the error is logged but loading continues for other fence types. Fence
   * layers referencing unfetchable types will be included in the layers array
   * but their type definition will be absent from the fenceTypes map.
   */
  private async loadFenceLayers(
    fenceLayers: SerializedFenceLayer[]
  ): Promise<LoadedFenceData> {
    if (fenceLayers.length === 0) {
      return { layers: [], fenceTypes: new Map() };
    }

    // De-duplicate fence type keys across all layers
    const uniqueKeys = [
      ...new Set(fenceLayers.map((layer) => layer.fenceTypeKey)),
    ];

    // Fetch fence type definitions in parallel
    const fenceTypes = new Map<string, FenceTypeDefinition>();

    await Promise.all(
      uniqueKeys.map(async (key) => {
        try {
          const url = `${FENCE_API_BASE_URL}/api/fence-types/by-key/${encodeURIComponent(key)}`;
          const response = await fetch(url);

          if (!response.ok) {
            console.error(
              `[Game] Fence type not found: "${key}" (HTTP ${response.status})`
            );
            return;
          }

          const definition: FenceTypeDefinition = await response.json();
          fenceTypes.set(key, definition);
        } catch (error) {
          console.error(
            `[Game] Failed to fetch fence type: "${key}"`,
            error
          );
        }
      })
    );

    return { layers: fenceLayers, fenceTypes };
  }

  /**
   * Load sprite images referenced by fence type definitions into Phaser's
   * texture manager.
   *
   * Extracts unique spriteIds from all frame mappings (connection + gate),
   * fetches each sprite record from the API to obtain a presigned S3 URL,
   * then loads the image and registers it as a Phaser texture.
   *
   * Sprites that are already registered in Phaser (e.g., shared with terrain)
   * are skipped. Failed loads are logged but do not block other sprites.
   */
  private async loadFenceSpriteImages(
    fenceTypes: Map<string, FenceTypeDefinition>
  ): Promise<void> {
    // Collect unique spriteIds from all fence type frame mappings
    const spriteIds = new Set<string>();
    for (const def of fenceTypes.values()) {
      for (const frame of Object.values(def.frameMapping)) {
        spriteIds.add(frame.spriteId);
      }
      if (def.gateFrameMapping) {
        for (const frame of Object.values(def.gateFrameMapping)) {
          spriteIds.add(frame.spriteId);
        }
      }
    }

    // Load each sprite image that isn't already in Phaser's texture manager
    await Promise.all(
      [...spriteIds].map(async (spriteId) => {
        if (this.textures.exists(spriteId)) return;

        try {
          // Fetch sprite record to get the presigned S3 URL
          const url = `${FENCE_API_BASE_URL}/api/sprites/${encodeURIComponent(spriteId)}`;
          const response = await fetch(url);
          if (!response.ok) {
            console.error(
              `[Game] Sprite not found: "${spriteId}" (HTTP ${response.status})`
            );
            return;
          }

          const spriteRecord: SpriteRecord = await response.json();

          // Load the image from S3
          const img = await this.loadImageElement(spriteRecord.s3Url);

          // Register as a Phaser texture
          this.textures.addImage(spriteId, img);
        } catch (error) {
          console.error(
            `[Game] Failed to load sprite image: "${spriteId}"`,
            error
          );
        }
      })
    );
  }

  /**
   * Load an image from a URL and return the HTMLImageElement once loaded.
   */
  private loadImageElement(imageUrl: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = (err) => reject(err);
      img.src = imageUrl;
    });
  }

  /**
   * Generate virtual tileset textures for each fence type, create a
   * RenderTexture for fence layers, and stamp all fence frames.
   *
   * Uses the same stamp technique as terrain rendering:
   * 1. Create a temporary Image game object (stamp)
   * 2. For each cell, set the stamp's texture/frame
   * 3. Draw the stamp onto the RenderTexture at the cell's pixel position
   *
   * Gate positions are collected during the rendering pass and stored
   * on `this.gatePositions` for the interaction system (Task 5C).
   */
  private async renderFenceLayers(data: LoadedFenceData): Promise<void> {
    const { layers, fenceTypes } = data;
    if (layers.length === 0 || fenceTypes.size === 0) return;

    // Step 1: Load sprite images referenced by fence type definitions
    await this.loadFenceSpriteImages(fenceTypes);

    // Step 2: Generate virtual tileset textures for each fence type
    for (const [fenceTypeKey, fenceDef] of fenceTypes) {
      const textureKey = `fence-${fenceTypeKey}`;
      if (this.textures.exists(textureKey)) continue;

      const frameImages: FrameImageSource[] = [];

      // Add connection frames (1-16): bitmask 0-15 maps to frame index 1-16
      for (let bitmask = 0; bitmask <= 15; bitmask++) {
        const frameKey = String(bitmask);
        const atlasFrameData = fenceDef.frameMapping[frameKey];
        if (!atlasFrameData) continue;

        const sourceImage = this.getSpriteSourceImage(atlasFrameData.spriteId);
        frameImages.push({
          frameIndex: bitmask + 1,
          image: sourceImage,
          srcX: atlasFrameData.frameX,
          srcY: atlasFrameData.frameY,
          srcW: atlasFrameData.frameW,
          srcH: atlasFrameData.frameH,
        });
      }

      // Add gate frames (17-20)
      if (fenceDef.gateFrameMapping) {
        const gateKeys = [
          'vertical_closed',
          'vertical_open',
          'horizontal_closed',
          'horizontal_open',
        ];
        gateKeys.forEach((gateKey, gateIdx) => {
          const atlasFrameData = fenceDef.gateFrameMapping?.[gateKey];
          if (!atlasFrameData) return;

          const sourceImage = this.getSpriteSourceImage(
            atlasFrameData.spriteId
          );
          frameImages.push({
            frameIndex: 17 + gateIdx,
            image: sourceImage,
            srcX: atlasFrameData.frameX,
            srcY: atlasFrameData.frameY,
            srcW: atlasFrameData.frameW,
            srcH: atlasFrameData.frameH,
          });
        });
      }

      // Generate the virtual tileset canvas (64x80 pixels)
      const tilesetCanvas = generateFenceTileset(frameImages, () =>
        document.createElement('canvas')
      );

      // Register the canvas as a Phaser texture
      this.textures.addCanvas(
        textureKey,
        tilesetCanvas as HTMLCanvasElement
      );

      // Register frame data for frames 1-20 (frame 0 = empty sentinel, skipped)
      const texture = this.textures.get(textureKey);
      for (let frameIdx = 1; frameIdx <= 20; frameIdx++) {
        const idx = frameIdx - 1;
        const srcX = (idx % 4) * FRAME_SIZE;
        const srcY = Math.floor(idx / 4) * FRAME_SIZE;
        texture.add(String(frameIdx), 0, srcX, srcY, FRAME_SIZE, FRAME_SIZE);
      }
    }

    // Step 3: Create fence RenderTexture above terrain, below player sprites
    const mapPixelW = MAP_WIDTH * TILE_SIZE;
    const mapPixelH = MAP_HEIGHT * TILE_SIZE;

    this.fenceRt = this.add.renderTexture(0, 0, mapPixelW, mapPixelH);
    this.fenceRt.setOrigin(0, 0);
    this.fenceRt.setDepth(FENCE_LAYER_DEPTH);

    // Step 4: Stamp fence frames using the same technique as terrain.
    // The stamp is kept alive (not destroyed) so it can be reused for
    // single-tile re-stamps when gate state changes at runtime (Task 5C).
    const tileScale = TILE_SIZE / FRAME_SIZE;
    this.fenceStamp = this.add
      .sprite(0, 0, '')
      .setScale(tileScale)
      .setOrigin(0, 0)
      .setVisible(false);

    for (const fenceLayer of layers) {
      const textureKey = `fence-${fenceLayer.fenceTypeKey}`;
      if (!this.textures.exists(textureKey)) continue;

      const mapHeight = fenceLayer.frames.length;
      const mapWidth = mapHeight > 0 ? fenceLayer.frames[0].length : 0;

      for (let y = 0; y < mapHeight; y++) {
        for (let x = 0; x < mapWidth; x++) {
          const frame = fenceLayer.frames[y][x];
          if (frame === 0) continue;

          this.fenceStamp.setTexture(textureKey, String(frame));
          this.fenceRt.draw(this.fenceStamp, x * TILE_SIZE, y * TILE_SIZE);
        }
      }
    }

    // Step 5: Build fence layer snapshots for walkability computation.
    // Constructs FenceLayerSnapshot cells from serialized frame + gate data.
    // Gate cells track open/closed state; regular fence cells block movement.
    this.fenceLayerSnapshots = this.buildFenceLayerSnapshots(layers);

    // Step 6: Register gate positions for the interaction system.
    // Determines NS vs EW orientation from the frame value at each gate cell.
    this.gatePositions = [];
    for (const fenceLayer of layers) {
      for (const gate of fenceLayer.gates) {
        // Determine orientation from the precomputed frame at the gate position.
        // Frames 17 (vertical_closed) and 18 (vertical_open) = NS corridor.
        // Frames 19 (horizontal_closed) and 20 (horizontal_open) = EW corridor.
        const frame = fenceLayer.frames[gate.y]?.[gate.x] ?? 0;
        const isNS = frame === 17 || frame === 18;

        this.gatePositions.push({
          x: gate.x,
          y: gate.y,
          fenceTypeKey: fenceLayer.fenceTypeKey,
          open: gate.open,
          isNS,
        });
      }
    }

    if (this.gatePositions.length > 0) {
      console.log(
        `[Game] Registered ${this.gatePositions.length} gate position(s)`
      );
    }

    console.log(
      `[Game] Fence layers rendered: ${layers.length} layer(s) at depth ${FENCE_LAYER_DEPTH}`
    );
  }

  /**
   * Get the source image for a sprite texture. Returns null if the texture
   * is not loaded (the caller handles null gracefully).
   */
  private getSpriteSourceImage(
    spriteId: string
  ): CanvasImageSource | null {
    if (!this.textures.exists(spriteId)) return null;
    const texture = this.textures.get(spriteId);
    return texture.getSourceImage() as CanvasImageSource;
  }

  /**
   * Per-frame update: drive remote sprite interpolation and gate interaction.
   * Local player movement is sent by WalkState via the Colyseus service.
   */
  override update(_time: number, delta: number): void {
    // Drive interpolation on all remote player sprites
    this.playerManager.update(delta);

    // Gate interaction: check E key press each frame.
    // Uses Phaser's JustDown to trigger only on the initial press, not on hold.
    if (
      this.interactKey &&
      Phaser.Input.Keyboard.JustDown(this.interactKey) &&
      this.room
    ) {
      // Convert player pixel position to tile coordinates.
      // Player sprite uses bottom-center origin (0.5, 1.0), so the player's
      // feet are at (this.player.x, this.player.y). The tile the player
      // occupies is determined by flooring the pixel position.
      const playerTileX = Math.floor(this.player.x / TILE_SIZE);
      const playerTileY = Math.floor(
        (this.player.y - 1) / TILE_SIZE
      );

      const nearbyGate = this.getNearbyGate(playerTileX, playerTileY);
      if (nearbyGate) {
        // Client does NOT toggle locally — sends request to server (authoritative model).
        this.room.send('GATE_TOGGLE', {
          x: nearbyGate.x,
          y: nearbyGate.y,
        });
      }
    }
  }

  /**
   * Find a gate adjacent to the given tile position (Manhattan distance = 1).
   *
   * Only checks the four cardinal directions (up, down, left, right).
   * Diagonal tiles are NOT considered adjacent for gate interaction
   * (Design Doc Section 3.6).
   *
   * @param playerTileX - Player tile X coordinate
   * @param playerTileY - Player tile Y coordinate
   * @returns The nearest gate within range, or null if none found
   */
  private getNearbyGate(
    playerTileX: number,
    playerTileY: number
  ): GatePosition | null {
    for (const gate of this.gatePositions) {
      const dx = Math.abs(gate.x - playerTileX);
      const dy = Math.abs(gate.y - playerTileY);
      if (dx + dy === 1) {
        return gate;
      }
    }
    return null;
  }

  /**
   * Register the server confirmation handler for gate state changes.
   *
   * Listens for 'GATE_STATE_CHANGED' messages from the Colyseus server.
   * On receipt, updates the local gate state, re-stamps the affected tile
   * on the fence RenderTexture, and updates the walkability grid.
   *
   * This handler is safe to register before fence layers are loaded —
   * it guards against missing fenceRt/fenceStamp and will simply no-op
   * if fence rendering has not completed yet.
   */
  private registerGateStateHandler(): void {
    if (!this.room) return;

    this.room.onMessage(
      'GATE_STATE_CHANGED',
      (data: { x: number; y: number; open: boolean }) => {
        // Find the gate in the local registry
        const gate = this.gatePositions.find(
          (g) => g.x === data.x && g.y === data.y
        );
        if (!gate) return;

        // Update local gate state
        gate.open = data.open;

        // Re-stamp only the changed tile on the fence RenderTexture.
        // Uses the persistent fenceStamp created during renderFenceLayers().
        if (this.fenceRt && this.fenceStamp) {
          const textureKey = `fence-${gate.fenceTypeKey}`;
          const bitmask = gate.isNS ? GATE_BITMASK_NS : GATE_BITMASK_EW;
          const newFrameIndex = getGateFrameIndex(bitmask, gate.open);

          // Erase the old tile content before drawing the new frame.
          // Gate open frames may have transparent areas, so we must clear
          // the tile region first to avoid visual artifacts from the previous frame.
          const eraser = this.add
            .graphics()
            .fillStyle(0xffffff)
            .fillRect(0, 0, TILE_SIZE, TILE_SIZE)
            .setVisible(false);
          this.fenceRt.erase(
            eraser,
            gate.x * TILE_SIZE,
            gate.y * TILE_SIZE
          );
          eraser.destroy();

          // Stamp the new gate frame
          this.fenceStamp.setTexture(textureKey, String(newFrameIndex));
          this.fenceRt.draw(
            this.fenceStamp,
            gate.x * TILE_SIZE,
            gate.y * TILE_SIZE
          );
        }

        // Update walkability grid via the fence layer snapshots.
        // Finds the gate cell in the snapshot and toggles its gateOpen state,
        // then calls updateCellWalkability to recompute the composite result.
        this.updateGateWalkability(data.x, data.y, data.open);
      }
    );
  }

  /**
   * Update the walkability grid for a gate cell after a state change.
   *
   * Locates the gate's cell in the fence layer snapshots, updates its
   * gateOpen state, then calls updateCellWalkability from map-lib to
   * recompute the composite walkability for that cell.
   *
   * @param gateX - Gate tile X coordinate
   * @param gateY - Gate tile Y coordinate
   * @param open - New open/closed state
   */
  private updateGateWalkability(
    gateX: number,
    gateY: number,
    open: boolean
  ): void {
    if (
      !this.mapData ||
      this.terrainWalkable.length === 0 ||
      this.fenceLayerSnapshots.length === 0
    ) {
      return;
    }

    // Update the gate cell's open state in the fence layer snapshot
    for (const snapshot of this.fenceLayerSnapshots) {
      const cell = snapshot.cells[gateY]?.[gateX];
      if (cell && cell.isGate) {
        cell.gateOpen = open;
        break;
      }
    }

    // Recompute walkability for this single cell
    updateCellWalkability(
      this.mapData.walkable,
      this.terrainWalkable,
      this.fenceLayerSnapshots,
      gateX,
      gateY
    );
  }

  /**
   * Build FenceLayerSnapshot[] from serialized fence layer data.
   *
   * Constructs a cells grid for each layer where:
   * - cells[y][x] = null if frames[y][x] === 0 (no fence)
   * - cells[y][x] = FenceCellData with isGate=true for gate positions
   * - cells[y][x] = FenceCellData with isGate=false for regular fence cells
   *
   * The fenceTypeId field is set to an empty string because it is not needed
   * for walkability computation (only isGate and gateOpen are checked).
   */
  private buildFenceLayerSnapshots(
    layers: SerializedFenceLayer[]
  ): FenceLayerSnapshot[] {
    return layers.map((layer) => {
      const mapHeight = layer.frames.length;
      const mapWidth = mapHeight > 0 ? layer.frames[0].length : 0;

      // Build a lookup set for gate positions in this layer
      const gateSet = new Set<string>();
      const gateOpenMap = new Map<string, boolean>();
      for (const gate of layer.gates) {
        const key = `${gate.x},${gate.y}`;
        gateSet.add(key);
        gateOpenMap.set(key, gate.open);
      }

      // Construct cells grid
      const cells: (FenceCellData | null)[][] = [];
      for (let y = 0; y < mapHeight; y++) {
        cells[y] = [];
        for (let x = 0; x < mapWidth; x++) {
          if (layer.frames[y][x] === 0) {
            cells[y][x] = null;
          } else {
            const key = `${x},${y}`;
            const isGate = gateSet.has(key);
            cells[y][x] = {
              fenceTypeId: '',
              isGate,
              gateOpen: isGate ? (gateOpenMap.get(key) ?? false) : false,
            };
          }
        }
      }

      return { cells };
    });
  }

  shutdown(): void {
    this.playerManager.destroy();
    if (this.fenceStamp) {
      this.fenceStamp.destroy();
      this.fenceStamp = null;
    }
  }
}
