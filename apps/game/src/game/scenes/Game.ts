import { Scene } from 'phaser';
import { EventBus } from '../EventBus';
import { TILE_SIZE, FRAME_SIZE, MAP_WIDTH, MAP_HEIGHT } from '../constants';
import { MapGenerator, IslandPass, ConnectivityPass, WaterBorderPass, AutotilePass } from '../mapgen';
import { EMPTY_FRAME } from '../autotile';
import type { GeneratedMap } from '../mapgen/types';

export class Game extends Scene {
  private mapData!: GeneratedMap;
  private rt!: Phaser.GameObjects.RenderTexture;
  private hover!: Phaser.GameObjects.Graphics;

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

    // Camera: center map in viewport
    const cam = this.cameras.main;
    cam.setBackgroundColor(0x215c81);

    const zoomX = this.scale.width / mapPixelW;
    const zoomY = this.scale.height / mapPixelH;
    cam.setZoom(Math.min(zoomX, zoomY));
    cam.centerOn(mapPixelW / 2, mapPixelH / 2);

    // Tile hover highlight
    this.hover = this.add.graphics();
    this.hover.setDepth(1);
    let prevTileX = -1;
    let prevTileY = -1;

    // Drag-scroll + hover
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.isDown) {
        cam.scrollX -= (pointer.x - pointer.prevPosition.x) / cam.zoom;
        cam.scrollY -= (pointer.y - pointer.prevPosition.y) / cam.zoom;
        this.hover.clear();
        prevTileX = -1;
        prevTileY = -1;
        return;
      }

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
