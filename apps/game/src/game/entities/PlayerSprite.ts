import Phaser from 'phaser';
import { getSkinByKey } from '../characters/skin-registry';
import { animKey, type Direction } from '../characters/frame-map';
import { TILE_SIZE, PLAYER_DEPTH } from '../constants';

/** Teleport threshold: if position delta exceeds this, snap instead of lerp. */
const SNAP_THRESHOLD = TILE_SIZE * 5; // 80 pixels (5 tiles)

/** Interpolation duration in milliseconds (matches server tick interval). */
const LERP_DURATION_MS = 100;

/**
 * Rendered representation of a remote player in the game world.
 *
 * Replaces the previous Graphics-based implementation with a proper
 * Phaser.GameObjects.Sprite that plays character animations and smoothly
 * interpolates between server position updates.
 *
 * PlayerManager is responsible for skipping creation of PlayerSprite
 * instances for the local player.
 */
export class PlayerSprite {
  private sprite: Phaser.GameObjects.Sprite;
  private nameLabel: Phaser.GameObjects.Text;
  readonly sessionId: string;

  // Interpolation state
  private startX: number;
  private startY: number;
  private targetX: number;
  private targetY: number;
  private lerpElapsed = 0;
  private isLerping = false;

  // Animation state
  private currentDirection: Direction = 'down';
  private currentAnimState = 'idle';
  private skinKey: string;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    skinKey: string,
    name: string,
    _isLocal: boolean,
    sessionId: string
  ) {
    this.sessionId = sessionId;

    // Look up skin to get the correct sheetKey (skinKey IS the sheetKey
    // since skin-registry now uses unique keys like 'scout_1')
    const skin = getSkinByKey(skinKey);
    this.skinKey = skin ? skin.sheetKey : 'scout_1';

    // Create sprite with bottom-center origin (consistent with local Player)
    this.sprite = scene.add.sprite(x, y, this.skinKey);
    this.sprite.setOrigin(0.5, 1.0);
    this.sprite.setDepth(PLAYER_DEPTH);

    // Play default idle animation
    const idleKey = animKey(this.skinKey, 'idle', 'down');
    this.sprite.play(idleKey, true);

    // Name label above sprite
    this.nameLabel = scene.add.text(x, y - 34, name, {
      fontSize: '10px',
      color: '#ffffff',
      align: 'center',
    });
    this.nameLabel.setOrigin(0.5, 1);
    this.nameLabel.setDepth(PLAYER_DEPTH);

    // Initialize interpolation anchors
    this.startX = x;
    this.startY = y;
    this.targetX = x;
    this.targetY = y;
  }

  /**
   * Set a new interpolation target position.
   * If the delta exceeds SNAP_THRESHOLD, snap immediately.
   */
  setTarget(x: number, y: number): void {
    const dx = x - this.sprite.x;
    const dy = y - this.sprite.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > SNAP_THRESHOLD) {
      // Teleport: snap immediately
      this.sprite.setPosition(x, y);
      this.nameLabel.setPosition(x, y - 34);
      this.startX = x;
      this.startY = y;
      this.targetX = x;
      this.targetY = y;
      this.isLerping = false;
    } else if (dist < 1) {
      // Already at target, no interpolation needed
      this.isLerping = false;
    } else {
      // Start interpolation from current rendered position
      this.startX = this.sprite.x;
      this.startY = this.sprite.y;
      this.targetX = x;
      this.targetY = y;
      this.lerpElapsed = 0;
      this.isLerping = true;
    }
  }

  /**
   * Update the displayed animation based on server state.
   */
  updateAnimation(direction: string, animState: string): void {
    const dir = direction as Direction;
    if (
      dir !== this.currentDirection ||
      animState !== this.currentAnimState
    ) {
      this.currentDirection = dir;
      this.currentAnimState = animState;
      const key = animKey(this.skinKey, animState, dir);
      this.sprite.play(key, true);
    }
  }

  /**
   * Per-frame update: advance interpolation.
   * Must be called from PlayerManager.update() each frame.
   *
   * @param delta - Milliseconds since last frame
   */
  update(delta: number): void {
    if (!this.isLerping) return;

    this.lerpElapsed += delta;
    const t = Math.min(this.lerpElapsed / LERP_DURATION_MS, 1);

    const x = Phaser.Math.Linear(this.startX, this.targetX, t);
    const y = Phaser.Math.Linear(this.startY, this.targetY, t);

    this.sprite.setPosition(x, y);
    this.nameLabel.setPosition(x, y - 34);

    if (t >= 1) {
      this.isLerping = false;
    }
  }

  /**
   * Clean up sprite and name label from the scene.
   */
  destroy(): void {
    this.sprite.destroy();
    this.nameLabel.destroy();
  }
}
