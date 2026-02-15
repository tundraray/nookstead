import { GameObjects, Scene } from 'phaser';
import {
  TILE_SIZE,
  PLAYER_DEPTH,
  PLAYER_SIZE,
  PLAYER_LOCAL_COLOR,
  PLAYER_REMOTE_COLOR,
  PLAYER_LABEL_FONT_SIZE,
} from '../constants';

export function tileToPixel(
  tileX: number,
  tileY: number
): { px: number; py: number } {
  return {
    px: tileX * TILE_SIZE + TILE_SIZE / 2,
    py: tileY * TILE_SIZE + TILE_SIZE / 2,
  };
}

export class PlayerSprite {
  private container: GameObjects.Container;
  readonly sessionId: string;

  constructor(
    scene: Scene,
    tileX: number,
    tileY: number,
    name: string,
    isLocal: boolean,
    sessionId: string
  ) {
    this.sessionId = sessionId;
    const { px, py } = tileToPixel(tileX, tileY);

    const color = isLocal ? PLAYER_LOCAL_COLOR : PLAYER_REMOTE_COLOR;
    const half = PLAYER_SIZE / 2;

    const gfx = scene.add.graphics();
    gfx.fillStyle(color, 1);
    gfx.fillRoundedRect(-half, -half, PLAYER_SIZE, PLAYER_SIZE, 4);
    if (isLocal) {
      gfx.lineStyle(2, 0xffffff, 0.9);
      gfx.strokeRoundedRect(-half, -half, PLAYER_SIZE, PLAYER_SIZE, 4);
    }

    const label = scene.add.text(0, -half - 4, name, {
      fontSize: `${PLAYER_LABEL_FONT_SIZE}px`,
      color: '#ffffff',
      align: 'center',
    });
    label.setOrigin(0.5, 1);

    this.container = scene.add.container(px, py, [gfx, label]);
    this.container.setDepth(PLAYER_DEPTH);
  }

  moveTo(tileX: number, tileY: number): void {
    const { px, py } = tileToPixel(tileX, tileY);
    this.container.setPosition(px, py);
  }

  destroy(): void {
    this.container.destroy();
  }
}
