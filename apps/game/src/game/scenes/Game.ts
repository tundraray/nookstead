import { Scene } from 'phaser';
import { EventBus } from '../EventBus';
import { TILE_SIZE, MAP_WIDTH, MAP_HEIGHT } from '../constants';
import { MapGenerator, IslandPass, ConnectivityPass, WaterBorderPass, AutotilePass } from '../mapgen';
import { EMPTY_FRAME } from '../autotile';
import type { GeneratedMap } from '../mapgen/types';

/** Per-layer info emitted on tile click. */
export interface TileLayerInfo {
  name: string;
  terrainKey: string;
  frame: number;
}

/** Payload emitted via EventBus on 'tile-click'. */
export interface TileClickEvent {
  tileX: number;
  tileY: number;
  terrain: string;
  elevation: number;
  seed: number;
  layers: TileLayerInfo[];
}

/** Payload received via EventBus on 'tile-replace'. */
export interface TileReplaceEvent {
  tileX: number;
  tileY: number;
  layerName: string;
  newFrame: number;
}

export class Game extends Scene {
  private mapData!: GeneratedMap;
  private rt!: Phaser.GameObjects.RenderTexture;

  constructor() {
    super('Game');
  }

  create() {
    // Generate island using the pipeline
    const generator = new MapGenerator(MAP_WIDTH, MAP_HEIGHT)
      .addPass(new IslandPass())
      .addPass(new ConnectivityPass())
      .addPass(new WaterBorderPass())
      .setLayerPass(new AutotilePass());

    // Read seed from URL query string (?seed=12345)
    const urlSeed = new URLSearchParams(window.location.search).get('seed');
    const seed = urlSeed ? Number(urlSeed) : undefined;

    this.mapData = generator.generate(seed);

    // Update URL with actual seed so the map is shareable
    const url = new URL(window.location.href);
    url.searchParams.set('seed', String(this.mapData.seed));
    window.history.replaceState(null, '', url.toString());

    const mapPixelW = MAP_WIDTH * TILE_SIZE;
    const mapPixelH = MAP_HEIGHT * TILE_SIZE;

    // Render all layers to a single RenderTexture at native resolution.
    // This eliminates sub-pixel seam artifacts at fractional zoom levels.
    // Create a 1-tile white texture used for erasing individual tiles
    const eraseGfx = this.add.graphics();
    eraseGfx.fillStyle(0xffffff, 1);
    eraseGfx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    eraseGfx.generateTexture('__erase_tile', TILE_SIZE, TILE_SIZE);
    eraseGfx.destroy();

    this.rt = this.add.renderTexture(0, 0, mapPixelW, mapPixelH);
    const rt = this.rt;
    rt.setOrigin(0, 0);

    for (const layerData of this.mapData.layers) {
      for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
          const frame = layerData.frames[y][x];
          if (frame === EMPTY_FRAME) continue;

          rt.drawFrame(
            layerData.terrainKey,
            frame,
            x * TILE_SIZE,
            y * TILE_SIZE,
          );
        }
      }
    }

    // Camera: center map in viewport
    const cam = this.cameras.main;
    cam.setBackgroundColor(0x1a1a2e);

    const zoomX = this.scale.width / mapPixelW;
    const zoomY = this.scale.height / mapPixelH;
    cam.setZoom(Math.min(zoomX, zoomY));
    cam.centerOn(mapPixelW / 2, mapPixelH / 2);

    // Track drag distance to distinguish click from drag
    let dragDist = 0;

    // Drag-scroll
    this.input.on('pointerdown', () => {
      dragDist = 0;
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.isDown) {
        const dx = pointer.x - pointer.prevPosition.x;
        const dy = pointer.y - pointer.prevPosition.y;
        dragDist += Math.abs(dx) + Math.abs(dy);
        cam.scrollX -= dx / cam.zoom;
        cam.scrollY -= dy / cam.zoom;
      }
    });

    // Tile click (only if not dragging)
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (dragDist > 5) return; // was a drag, not a click

      const worldX = pointer.worldX;
      const worldY = pointer.worldY;
      const tileX = Math.floor(worldX / TILE_SIZE);
      const tileY = Math.floor(worldY / TILE_SIZE);

      if (tileX < 0 || tileX >= MAP_WIDTH || tileY < 0 || tileY >= MAP_HEIGHT) return;

      const cell = this.mapData.grid[tileY][tileX];
      const layers: TileLayerInfo[] = this.mapData.layers
        .map((l) => ({ name: l.name, terrainKey: l.terrainKey, frame: l.frames[tileY][tileX] }))
        .filter((l) => l.frame !== EMPTY_FRAME);

      EventBus.emit('tile-click', {
        tileX,
        tileY,
        terrain: cell.terrain,
        elevation: cell.elevation,
        seed: this.mapData.seed,
        layers,
      } satisfies TileClickEvent);
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

    // Listen for tile replacement from the UI
    EventBus.on('tile-replace', (ev: TileReplaceEvent) => {
      const { tileX, tileY, layerName, newFrame } = ev;
      if (tileX < 0 || tileX >= MAP_WIDTH || tileY < 0 || tileY >= MAP_HEIGHT) return;

      const layer = this.mapData.layers.find((l) => l.name === layerName);
      if (!layer) return;

      // Update the stored frame data
      layer.frames[tileY][tileX] = newFrame;

      // Redraw the entire tile stack at this position
      const px = tileX * TILE_SIZE;
      const py = tileY * TILE_SIZE;
      this.rt.erase('__erase_tile', px, py);

      for (const l of this.mapData.layers) {
        const frame = l.frames[tileY][tileX];
        if (frame === EMPTY_FRAME) continue;
        this.rt.drawFrame(l.terrainKey, frame, px, py);
      }
    });

    EventBus.emit('current-scene-ready', this);
  }
}
