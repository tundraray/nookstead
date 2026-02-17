import { Scene } from 'phaser';
import { Callbacks } from '@colyseus/sdk';
import type { Room } from '@colyseus/sdk';
import {
  joinChunkRoom,
  leaveCurrentRoom,
} from '@/services/colyseus';
import type { ChunkRoomState } from '@nookstead/shared';
import { EventBus } from '../EventBus';
import { PlayerSprite } from '../entities/PlayerSprite';
import type { Player } from '../entities/Player';

/**
 * Manages multiplayer player state synchronization.
 *
 * Handles:
 * - Connecting to the Colyseus chunk room
 * - Creating animated PlayerSprite instances for remote players
 * - Per-frame interpolation updates for remote player sprites
 *
 * Local player movement is sent by WalkState directly via the Colyseus service.
 */
export class PlayerManager {
  private scene: Scene;
  private room: Room<unknown, ChunkRoomState> | null = null;
  private sprites = new Map<string, PlayerSprite>();
  private detachCallbacks: (() => void)[] = [];
  /** Local Player entity for reconciliation wiring (FR-16). */
  private localPlayer: Player | null = null;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  /**
   * Register the local Player entity for server reconciliation (FR-16).
   *
   * When the server sends authoritative position updates for this session,
   * the PlayerManager calls player.reconcile() to correct any prediction drift.
   * Must be called before connect() so the reference is available when the
   * onAdd callback fires for the local player.
   */
  setLocalPlayer(player: Player): void {
    this.localPlayer = player;
  }

  async connect(existingRoom?: Room<unknown, ChunkRoomState>): Promise<void> {
    EventBus.emit('multiplayer:connecting');

    try {
      this.room = existingRoom ?? (await joinChunkRoom());
    } catch (err) {
      EventBus.emit('multiplayer:error', err);
      console.error('[PlayerManager] Failed to join chunk room:', err);
      return;
    }

    // Guard: scene may have been destroyed while awaiting
    if (!this.scene.scene.isActive(this.scene.scene.key)) {
      leaveCurrentRoom().catch(() => { /* fire-and-forget */ });
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

        if (isLocal && this.localPlayer) {
          // Wire server position updates to local player reconciliation (FR-16)
          const detachChange = $.onChange(player, () => {
            this.localPlayer?.reconcile(player.worldX, player.worldY);
          });
          this.detachCallbacks.push(detachChange);
        }

        if (!isLocal) {
          // Create animated sprite for remote player using server-assigned skin
          const sprite = new PlayerSprite(
            this.scene,
            player.worldX,
            player.worldY,
            player.skin || 'scout_1',
            player.name || sessionId,
            false,
            sessionId
          );
          this.sprites.set(sessionId, sprite);

          // Listen for state changes on this remote player
          const detachChange = $.onChange(player, () => {
            // Update remote sprite target position using worldX/worldY
            sprite.setTarget(player.worldX, player.worldY);

            // Derive animState client-side: walking if position differs from
            // current rendered position, idle otherwise
            const isMoving =
              player.worldX !== sprite.getX() ||
              player.worldY !== sprite.getY();
            sprite.updateAnimation(
              player.direction || 'down',
              isMoving ? 'walk' : 'idle'
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
    leaveCurrentRoom().catch(() => { /* fire-and-forget */ });
  }
}
