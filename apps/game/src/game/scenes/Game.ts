import { Scene } from 'phaser';
import { EventBus } from '../EventBus';
import { TILE_SIZE, FRAME_SIZE, MAP_WIDTH, MAP_HEIGHT, CLICK_THRESHOLD } from '../constants';
import { MapRenderer } from '@nookstead/map-renderer';
import type {
  MapDataPayload,
  GeneratedMap,
} from '@nookstead/shared';
import { isTileLayer, isObjectLayer, findSpawnTile, ClientMessage, ServerMessage } from '@nookstead/shared';
import type { GameClockConfig } from '@nookstead/shared';
import type { Room } from '@colyseus/sdk';
import { PlayerManager } from '../multiplayer/PlayerManager';
import { Player } from '../entities/Player';
import { ObjectRenderer } from '../objects/ObjectRenderer';
import { isMovementLocked, setupMovementLock, teardownMovementLock } from '../systems/dialogue-lock';
import { isTextInputFocused } from '../input/InputController';
import { createClickPathfindingSystem, type ClickPathfindingSystem } from '../systems/click-pathfinding';
import { GameClockClient } from '../systems/GameClockClient';
import type { GameObjectCache } from '../services/game-object-cache';
import { findNearestWalkable } from '../systems/displacement';

export class Game extends Scene {
  private rawMapData: MapDataPayload | null = null;
  private mapData: GeneratedMap | null = null;
  private mapRenderer?: MapRenderer;
  private objectRenderer?: ObjectRenderer;
  private hover!: Phaser.GameObjects.Graphics;
  private playerManager!: PlayerManager;
  private player!: Player;
  private room: Room | null = null;
  private serverSpawnX: number | undefined;
  private serverSpawnY: number | undefined;
  private serverSpawnDirection: 'up' | 'down' | 'left' | 'right' | undefined;
  private clickPathSystem!: ClickPathfindingSystem;
  private disconnectHandler?: () => void;
  private hardResetHandler?: () => void;
  private gameClock: GameClockClient | null = null;

  /**
   * X key for toggling the sit action from idle state.
   */
  private xKey: Phaser.Input.Keyboard.Key | null = null;

  constructor() {
    super('Game');
  }

  /**
   * Called by Phaser before create() with data from scene.start().
   * Receives mapData and room from LoadingScene.
   */
  init(data: { mapData: MapDataPayload; room?: Room; clockConfig?: GameClockConfig | null }): void {
    this.rawMapData = data.mapData;
    this.room = data.room ?? null;
    this.serverSpawnX = data.mapData.spawnX;
    this.serverSpawnY = data.mapData.spawnY;
    this.serverSpawnDirection = data.mapData.spawnDirection;

    // Initialize game clock from config received during loading
    if (data.clockConfig) {
      if (this.gameClock) {
        this.gameClock.destroy();
      }
      this.gameClock = new GameClockClient(data.clockConfig);
    }
  }

  create() {
    if (!this.rawMapData) {
      console.error('[Game] No mapData received from LoadingScene!');
      return;
    }

    // Separate tile layers from object layers using type guards
    const tileLayers = this.rawMapData.layers.filter(isTileLayer);
    const objectLayers = this.rawMapData.layers.filter(isObjectLayer);

    // Build a GeneratedMap-compatible object from tile layers for MapRenderer.
    // SerializedTileLayer is structurally compatible with LayerData.
    // The grid cast bridges SerializedCell.terrain (string) vs Cell.terrain (TerrainCellType).
    const tileMap = {
      width: this.rawMapData.width,
      height: this.rawMapData.height,
      layers: tileLayers,
      grid: this.rawMapData.grid,
      walkable: this.rawMapData.walkable,
    } as unknown as GeneratedMap;

    // Keep a GeneratedMap reference for subsystems that need walkable/grid data
    this.mapData = tileMap;

    const mapPixelW = this.rawMapData.width * TILE_SIZE;
    const mapPixelH = this.rawMapData.height * TILE_SIZE;

    // Render tile layers to a single RenderTexture via MapRenderer.
    this.mapRenderer = new MapRenderer(this, { tileSize: TILE_SIZE, frameSize: FRAME_SIZE });
    this.mapRenderer.render(tileMap);

    // Render object layers using ObjectRenderer (if cache is available)
    const cache = this.game.registry.get('gameObjectCache') as GameObjectCache | undefined;
    if (cache && objectLayers.length > 0) {
      this.objectRenderer = new ObjectRenderer(this, objectLayers, cache, TILE_SIZE);
    }

    // Determine spawn position: prefer server-computed, fall back to client-side
    let spawnX: number;
    let spawnY: number;
    if (this.serverSpawnX != null && this.serverSpawnY != null) {
      spawnX = this.serverSpawnX;
      spawnY = this.serverSpawnY;

      // Validate walkability: if saved position is now occupied/unwalkable, relocate
      const tileX = Math.floor(spawnX / TILE_SIZE);
      const tileY = Math.floor(spawnY / TILE_SIZE) - 1; // -1: spawnY is feet (bottom edge)
      const walkable = this.mapData.walkable;
      if (
        walkable &&
        (tileX < 0 || tileX >= MAP_WIDTH ||
         tileY < 0 || tileY >= MAP_HEIGHT ||
         !walkable[tileY]?.[tileX])
      ) {
        // Saved position is unwalkable — find nearest walkable tile
        const nearby = findNearestWalkable(tileX, tileY, walkable, MAP_WIDTH, MAP_HEIGHT);
        if (nearby) {
          spawnX = nearby.tileX * TILE_SIZE + TILE_SIZE / 2;
          spawnY = (nearby.tileY + 1) * TILE_SIZE;
        } else {
          // Last resort: use findSpawnTile
          const spawn = findSpawnTile(
            this.mapData.walkable,
            this.mapData.grid,
            MAP_WIDTH,
            MAP_HEIGHT,
          );
          spawnX = spawn.tileX * TILE_SIZE + TILE_SIZE / 2;
          spawnY = (spawn.tileY + 1) * TILE_SIZE;
        }
      }
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
    this.player = new Player(this, spawnX, spawnY, this.mapData, this.serverSpawnDirection);

    // Enable Arcade Physics on the player for collision detection
    this.physics.add.existing(this.player);
    // Direct control: position is set externally via setPosition(), not velocity.
    // Prevents physics postUpdate from fighting manual position changes.
    (this.player.body as Phaser.Physics.Arcade.Body).setDirectControl(true);

    // Register collider between player and object collision bodies (AC-5.2)
    if (this.objectRenderer) {
      this.physics.add.collider(
        this.player,
        this.objectRenderer.getCollisionGroup(),
      );
    }

    // Camera: follow player with lerp smoothing, bounded by map
    const cam = this.cameras.main;
    cam.setBackgroundColor(0x215c81);
    cam.setBounds(0, 0, mapPixelW, mapPixelH);
    cam.startFollow(this.player, true, 1, 1);
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

    // Movement lock: listen for dialogue lock/unlock events
    setupMovementLock();

    // Click-to-move pathfinding system (A* path computation + visual feedback)
    this.clickPathSystem = createClickPathfindingSystem(
      this,
      this.mapData.walkable,
      TILE_SIZE,
    );

    // Expose clearMarker via scene data so WalkState can clear the destination
    // marker on arrival or keyboard cancel without a direct import dependency.
    this.data.set('clickPathClearMarker', () => this.clickPathSystem.clearMarker());

    // Click-to-move: track pointer down position to distinguish clicks from drags
    let pointerDownX = 0;
    let pointerDownY = 0;
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointerDownX = pointer.x;
      pointerDownY = pointer.y;
    });
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (isMovementLocked()) return;

      const dx = pointer.x - pointerDownX;
      const dy = pointer.y - pointerDownY;
      if (Math.sqrt(dx * dx + dy * dy) > CLICK_THRESHOLD) return;

      // Delegate to the pathfinding system (handles bounds, walkability, path computation)
      this.clickPathSystem.handleClick(pointer.worldX, pointer.worldY, this.player);
    });

    // Re-fit camera when the canvas resizes
    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      cam.setSize(gameSize.width, gameSize.height);
    });

    // Register X key for sit toggle
    if (this.input.keyboard) {
      this.xKey = this.input.keyboard.addKey('X');
    }

    // Multiplayer — reuse existing room from LoadingScene to avoid duplicate connection
    this.playerManager = new PlayerManager(this);
    this.playerManager.setLocalPlayer(this.player);
    this.playerManager.connect(this.room ?? undefined);

    // Game Clock — receive server epoch and create the client clock
    this.room?.onMessage(ServerMessage.CLOCK_CONFIG, (data: GameClockConfig) => {
      console.log('[Game] CLOCK_CONFIG received:', data);
      // Destroy existing clock on reconnect/redirect to prevent interval leak
      if (this.gameClock) {
        this.gameClock.destroy();
      }
      this.gameClock = new GameClockClient(data);
    });

    // Return to LoadingScene (which has retry logic) on unexpected server disconnect
    this.disconnectHandler = () => {
      console.log('[Game] Server disconnected, returning to LoadingScene');
      this.scene.start('Loading');
    };
    EventBus.on('multiplayer:disconnected', this.disconnectHandler);

    // Hard reset: teleport player to spawn via server
    this.hardResetHandler = () => {
      if (this.room) {
        this.player.clearMoveTarget();
        this.room.send(ClientMessage.HARD_RESET);
      }
    };
    EventBus.on('player:hard-reset', this.hardResetHandler);

    EventBus.emit('current-scene-ready', this);
  }

  /**
   * Per-frame update: drive remote sprite interpolation.
   * Local player movement is sent by WalkState via the Colyseus service.
   */
  override update(_time: number, delta: number): void {
    // Drive interpolation on all remote player sprites
    this.playerManager.update(delta);

    // Sit toggle: X key (idle -> sit only; sit -> idle is handled by SitState)
    if (
      this.xKey &&
      Phaser.Input.Keyboard.JustDown(this.xKey) &&
      !isTextInputFocused() &&
      !isMovementLocked() &&
      this.player.stateMachine.currentState === 'idle'
    ) {
      this.player.stateMachine.setState('sit');
    }
  }

  shutdown(): void {
    teardownMovementLock();
    this.data.remove('clickPathClearMarker');
    this.clickPathSystem?.destroy();
    if (this.disconnectHandler) {
      EventBus.off('multiplayer:disconnected', this.disconnectHandler);
      this.disconnectHandler = undefined;
    }
    if (this.hardResetHandler) {
      EventBus.off('player:hard-reset', this.hardResetHandler);
      this.hardResetHandler = undefined;
    }
    if (this.gameClock) {
      this.gameClock.destroy();
      this.gameClock = null;
    }
    this.playerManager.destroy();
    this.objectRenderer?.destroy();
  }
}
