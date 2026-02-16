import { Scene } from 'phaser';
import { Callbacks } from '@colyseus/sdk';
import type { Room } from '@colyseus/sdk';
import {
  joinGameRoom,
  leaveGameRoom,
} from '@/services/colyseus';
import type { GameRoomState, PositionUpdatePayload } from '@nookstead/shared';
import {
  ClientMessage,
  POSITION_SYNC_INTERVAL_MS,
} from '@nookstead/shared';
import { EventBus } from '../EventBus';
import { PlayerSprite } from '../entities/PlayerSprite';

/**
 * Manages multiplayer player state synchronization.
 *
 * Handles:
 * - Connecting to the Colyseus game room
 * - Creating animated PlayerSprite instances for remote players
 * - Throttled position update sending for the local player
 * - Per-frame interpolation updates for remote player sprites
 * - Backward-compatible click-to-move via sendMove()
 */
export class PlayerManager {
  private scene: Scene;
  private room: Room<unknown, GameRoomState> | null = null;
  private sprites = new Map<string, PlayerSprite>();
  private detachCallbacks: (() => void)[] = [];

  // Position sync state for throttling and dirty-checking
  private lastSentTime = 0;
  private lastSentX = 0;
  private lastSentY = 0;
  private lastSentDirection = '';
  private lastSentAnimState = '';

  constructor(scene: Scene) {
    this.scene = scene;
  }

  async connect(): Promise<void> {
    EventBus.emit('multiplayer:connecting');

    try {
      this.room = await joinGameRoom();
    } catch (err) {
      EventBus.emit('multiplayer:error', err);
      console.error('[PlayerManager] Failed to join game room:', err);
      return;
    }

    // Guard: scene may have been destroyed while awaiting
    if (!this.scene.scene.isActive(this.scene.scene.key)) {
      leaveGameRoom().catch(() => { /* fire-and-forget */ });
      return;
    }

    this.setupCallbacks();
    this.setupRoomEvents();
    EventBus.emit('multiplayer:connected');
    console.log(
      '[PlayerManager] Connected, sessionId:',
      this.room.sessionId
    );
  }

  /**
   * Send a throttled position update to the server.
   * Only sends if enough time has elapsed (POSITION_SYNC_INTERVAL_MS)
   * and state has actually changed since the last send.
   */
  sendPositionUpdate(
    x: number,
    y: number,
    direction: string,
    animState: string
  ): void {
    if (!this.room) return;

    const now = Date.now();
    if (now - this.lastSentTime < POSITION_SYNC_INTERVAL_MS) return;

    // Skip if nothing changed (dirty check)
    if (
      x === this.lastSentX &&
      y === this.lastSentY &&
      direction === this.lastSentDirection &&
      animState === this.lastSentAnimState
    ) {
      return;
    }

    const payload: PositionUpdatePayload = {
      x,
      y,
      direction,
      animState,
    };

    this.room.send(ClientMessage.POSITION_UPDATE, payload);

    this.lastSentTime = now;
    this.lastSentX = x;
    this.lastSentY = y;
    this.lastSentDirection = direction;
    this.lastSentAnimState = animState;
  }

  /**
   * Per-frame update: drive interpolation on all remote player sprites.
   * Must be called from Game scene update loop.
   *
   * @param delta - Milliseconds since last frame
   */
  update(delta: number): void {
    for (const [sessionId, sprite] of this.sprites) {
      // Only interpolate remote sprites (should all be remote since
      // we skip creating sprites for local player, but guard anyway)
      if (sessionId !== this.room?.sessionId) {
        sprite.update(delta);
      }
    }
  }

  private setupCallbacks(): void {
    if (!this.room) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const $ = Callbacks.get(this.room as any);

    const detachAdd = $.onAdd(
      'players' as never,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (player: any, sessionId: any) => {
        const isLocal = sessionId === this.room!.sessionId;

        if (!isLocal) {
          // Create animated sprite for remote player using server-assigned skin
          const sprite = new PlayerSprite(
            this.scene,
            player.x,
            player.y,
            player.skin || 'scout_1',
            player.name || sessionId,
            false,
            sessionId
          );
          this.sprites.set(sessionId, sprite);

          // Listen for state changes on this remote player
          const detachChange = $.onChange(player, () => {
            sprite.setTarget(player.x, player.y);
            sprite.updateAnimation(
              player.direction || 'down',
              player.animState || 'idle'
            );
          });
          this.detachCallbacks.push(detachChange);
        }

        console.log(
          `[PlayerManager] Player added: ${sessionId}${isLocal ? ' (local)' : ''}, skin: ${player.skin}`
        );
      },
      true // immediate -- fire for players already in state
    );
    this.detachCallbacks.push(detachAdd);

    const detachRemove = $.onRemove(
      'players' as never,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (_player: any, sessionId: any) => {
        const sprite = this.sprites.get(sessionId);
        if (sprite) {
          sprite.destroy();
          this.sprites.delete(sessionId);
        }
        console.log(`[PlayerManager] Player removed: ${sessionId}`);
      }
    );
    this.detachCallbacks.push(detachRemove);
  }

  private setupRoomEvents(): void {
    if (!this.room) return;

    this.room.onLeave((code) => {
      console.log(`[PlayerManager] Left room, code: ${code}`);
      EventBus.emit('multiplayer:disconnected', code);
    });

    this.room.onError((code, message) => {
      console.error(`[PlayerManager] Room error: ${code} ${message}`);
      EventBus.emit('multiplayer:error', { code, message });
    });
  }

  /**
   * Send a click-to-move message with tile coordinates.
   * Kept for backward compatibility with the existing MOVE message handler.
   */
  sendMove(tileX: number, tileY: number): void {
    if (!this.room) return;
    this.room.send(ClientMessage.MOVE, { x: tileX, y: tileY });
  }

  destroy(): void {
    for (const detach of this.detachCallbacks) {
      detach();
    }
    this.detachCallbacks.length = 0;

    for (const sprite of this.sprites.values()) {
      sprite.destroy();
    }
    this.sprites.clear();

    this.room = null;
    leaveGameRoom().catch(() => { /* fire-and-forget */ });
  }
}
