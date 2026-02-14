import { Scene } from 'phaser';
import { EventBus } from '../EventBus';
import { TILE_SIZE } from '../constants';
import { TERRAINS, TerrainType } from '../terrain';
import { FRAME_NAMES } from '../autotile';

const AUTOTILE_COLS = 12;
const AUTOTILE_ROWS = 4;

export class Game extends Scene {
  private bgTiles: Phaser.GameObjects.Image[] = [];
  private selectedTerrain: TerrainType = TERRAINS[0];
  private widgetHighlight!: Phaser.GameObjects.Rectangle;
  private selectedFrame: number = TERRAINS[0].solidFrame;

  constructor() {
    super('Game');
  }

  create() {
    this.cameras.main.setBackgroundColor(0x1a1a2e);
    this.buildScene();

    this.scale.on('resize', () => {
      this.bgTiles = [];
      this.children.removeAll(true);
      this.buildScene();
    });
  }

  private buildScene() {
    const w = this.scale.width;
    const h = this.scale.height;

    // Background tiles
    const cols = Math.ceil(w / TILE_SIZE);
    const rows = Math.ceil(h / TILE_SIZE);
    const initial = this.selectedTerrain;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const tile = this.add.image(
          c * TILE_SIZE + TILE_SIZE / 2,
          r * TILE_SIZE + TILE_SIZE / 2,
          initial.key,
          this.selectedFrame
        );
        this.bgTiles.push(tile);
      }
    }

    // --- Tileset widget (left panel) ---
    this.buildWidget(w, h);

    // --- Terrain palette (bottom bar) ---
    this.buildPalette(w, h);

    EventBus.emit('current-scene-ready', this);
  }

  private buildWidget(_w: number, _h: number) {
    const gap = 1;
    const labelH = 14;
    const cellW = TILE_SIZE + gap;
    const cellH = TILE_SIZE + labelH + gap;
    const widgetW = AUTOTILE_COLS * cellW + gap + 16;
    const widgetH = AUTOTILE_ROWS * cellH + gap + 32;
    const wx = 8;
    const wy = 8;

    // Backdrop
    this.add
      .rectangle(wx + widgetW / 2, wy + widgetH / 2, widgetW, widgetH, 0x000000, 0.8)
      .setOrigin(0.5);

    // Title
    this.add.text(wx + 8, wy + 6, this.selectedTerrain.name, {
      fontFamily: 'Arial',
      fontSize: 10,
      color: '#e8d5b7',
    });

    // Highlight rect
    this.widgetHighlight = this.add
      .rectangle(0, 0, TILE_SIZE + 2, TILE_SIZE + 2)
      .setStrokeStyle(2, 0xffcc00)
      .setOrigin(0.5)
      .setVisible(false);

    const gridTop = wy + 22;
    const gridLeft = wx + 8;

    for (let row = 0; row < AUTOTILE_ROWS; row++) {
      for (let col = 0; col < AUTOTILE_COLS; col++) {
        const frame = row * AUTOTILE_COLS + col;
        const x = gridLeft + col * cellW + TILE_SIZE / 2;
        const y = gridTop + row * cellH + TILE_SIZE / 2;

        const img = this.add
          .image(x, y, this.selectedTerrain.key, frame)
          .setInteractive({ useHandCursor: true });

        img.on('pointerdown', () => {
          this.selectedFrame = frame;
          this.widgetHighlight.setPosition(x, y).setVisible(true);
          for (const tile of this.bgTiles) {
            tile.setTexture(this.selectedTerrain.key, frame);
          }
        });

        // Grid cell border
        this.add
          .rectangle(x, y, TILE_SIZE, TILE_SIZE)
          .setStrokeStyle(1, 0x444444)
          .setOrigin(0.5);

        // Frame number (top-left corner)
        this.add.text(x - TILE_SIZE / 2 + 2, y - TILE_SIZE / 2 + 1, String(frame), {
          fontFamily: 'Arial',
          fontSize: 8,
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 2,
        });

        // Value label under tile
        const label = FRAME_NAMES[frame] ?? String(frame);
        this.add
          .text(x, y + TILE_SIZE / 2 + 2, label, {
            fontFamily: 'Arial',
            fontSize: 10,
            color: '#cccccc',
            align: 'center',
          })
          .setOrigin(0.5, 0);
      }
    }

    // Show initial highlight on solid frame
    const sCol = this.selectedFrame % AUTOTILE_COLS;
    const sRow = Math.floor(this.selectedFrame / AUTOTILE_COLS);
    this.widgetHighlight
      .setPosition(
        gridLeft + sCol * cellW + TILE_SIZE / 2,
        gridTop + sRow * cellH + TILE_SIZE / 2
      )
      .setVisible(true);
  }

  private buildPalette(w: number, h: number) {
    const gap = 2;
    const labelH = 14;
    const cellW = TILE_SIZE + gap;
    const cellH = TILE_SIZE + labelH + gap;
    const perRow = Math.floor(w / cellW);
    const totalRows = Math.ceil(TERRAINS.length / perRow);
    const paletteH = totalRows * cellH + 28;
    const offsetX = (w - perRow * cellW + gap) / 2 + TILE_SIZE / 2;
    const paletteY = h - paletteH;

    this.add
      .rectangle(w / 2, paletteY + paletteH / 2, w, paletteH, 0x000000, 0.7)
      .setOrigin(0.5);

    this.add.text(8, paletteY + 6, 'Terrain — click to select', {
      fontFamily: 'Arial',
      fontSize: 11,
      color: '#e8d5b7',
    });

    TERRAINS.forEach((terrain, i) => {
      const row = Math.floor(i / perRow);
      const col = i % perRow;
      const x = offsetX + col * cellW;
      const y = paletteY + 24 + row * cellH + TILE_SIZE / 2;

      const img = this.add
        .image(x, y, terrain.key, terrain.solidFrame)
        .setInteractive({ useHandCursor: true });

      img.on('pointerdown', () => {
        this.selectedTerrain = terrain;
        this.selectedFrame = terrain.solidFrame;
        this.bgTiles = [];
        this.children.removeAll(true);
        this.buildScene();
      });

      this.add
        .text(x, y + TILE_SIZE / 2 + 2, terrain.name, {
          fontFamily: 'Arial',
          fontSize: 7,
          color: '#aaaaaa',
          align: 'center',
        })
        .setOrigin(0.5, 0);
    });
  }
}
