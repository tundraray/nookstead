import { Scene } from 'phaser';
import { EventBus } from '../EventBus';
import { TILE_SIZE, MAP_WIDTH, MAP_HEIGHT } from '../constants';
import { MapGenerator, IslandPass, ConnectivityPass, WaterBorderPass, AutotilePass } from '../mapgen';
import { EMPTY_FRAME } from '../autotile';
import type { GeneratedMap } from '../mapgen/types';

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

    // Drag-scroll
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.isDown) {
        cam.scrollX -= (pointer.x - pointer.prevPosition.x) / cam.zoom;
        cam.scrollY -= (pointer.y - pointer.prevPosition.y) / cam.zoom;
      }
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

    // Re-fit camera when the canvas resizes
    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      cam.setSize(gameSize.width, gameSize.height);
      const zx = gameSize.width / mapPixelW;
      const zy = gameSize.height / mapPixelH;
      cam.setZoom(Math.min(zx, zy));
      cam.centerOn(mapPixelW / 2, mapPixelH / 2);
    });

    EventBus.emit('current-scene-ready', this);
  }
}
