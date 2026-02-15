import { Scene } from 'phaser';
import { Callbacks } from '@colyseus/sdk';
import type { Room } from '@colyseus/sdk';
import {
  joinGameRoom,
  leaveGameRoom,
} from '@/services/colyseus';
import type { GameRoomState } from '@nookstead/shared';
import { ClientMessage } from '@nookstead/shared';
import { EventBus } from '../EventBus';
import { PlayerSprite } from '../entities/PlayerSprite';

export class PlayerManager {
  private scene: Scene;
  private room: Room<unknown, GameRoomState> | null = null;
  private sprites = new Map<string, PlayerSprite>();
  private detachCallbacks: (() => void)[] = [];

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

  private setupCallbacks(): void {
    if (!this.room) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const $ = Callbacks.get(this.room as any);

    const detachAdd = $.onAdd(
      'players' as never,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (player: any, sessionId: any) => {
        const isLocal = sessionId === this.room!.sessionId;
        const sprite = new PlayerSprite(
          this.scene,
          player.x,
          player.y,
          player.name || sessionId,
          isLocal,
          sessionId
        );
        this.sprites.set(sessionId, sprite);

        const detachChange = $.onChange(player, () => {
          sprite.moveTo(player.x, player.y);
        });
        this.detachCallbacks.push(detachChange);

        console.log(
          `[PlayerManager] Player added: ${sessionId}${isLocal ? ' (local)' : ''}`
        );
      },
      true // immediate — fire for players already in state
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
