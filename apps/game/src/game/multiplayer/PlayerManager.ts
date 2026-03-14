import { Scene } from 'phaser';
import { Callbacks } from '@colyseus/sdk';
import type { Room } from '@colyseus/sdk';
import {
  joinChunkRoom,
  leaveCurrentRoom,
} from '@/services/colyseus';
import {
  ClientMessage,
  ServerMessage,
  type ChunkRoomState,
  type DialogueStartWithRelationshipPayload,
  type DialogueStreamChunkPayload,
} from '@nookstead/shared';
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
  private botSprites = new Map<string, PlayerSprite>();
  private detachCallbacks: (() => void)[] = [];
  /** Local Player entity for reconciliation wiring (FR-16). */
  private localPlayer: Player | null = null;
  /** Set to true before client-initiated disconnect to suppress reconnect flow. */
  private intentionalLeave = false;

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
    // Using Phaser 3 status codes: 8 = SHUTDOWN, 9 = DESTROYED
    const status = this.scene.sys.settings.status;
    if (status >= 8) {
      console.warn(`[PlayerManager] Scene is shutting down or destroyed (status=${status}), leaving room!`);
      leaveCurrentRoom().catch(() => { /* fire-and-forget */ });
      return;
    }

    this.setupCallbacks();
    this.setupBotCallbacks();
    this.setupRoomEvents();
    this.setupBotDiagnostics();
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
    // Interpolate bot sprites (all bots are remote, no local check needed)
    for (const sprite of this.botSprites.values()) {
      sprite.update(delta);
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
        const isLocal = sessionId === this.room?.sessionId;

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

  private setupBotCallbacks(): void {
    if (!this.room) return;

    // Diagnostic: check if room state has bots collection
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const state = this.room.state as any;
    console.log(
      '[PlayerManager] setupBotCallbacks: state exists=', !!state,
      ', state.bots exists=', !!state?.bots,
      ', bots.size=', state?.bots?.size ?? 'N/A',
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const $ = Callbacks.get(this.room as any);

    const detachAdd = $.onAdd(
      'bots' as never,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (bot: any, botId: any) => {
        const sprite = new PlayerSprite(
          this.scene,
          bot.worldX,
          bot.worldY,
          bot.skin || 'scout_1',
          bot.name || botId,
          false, // isLocal: bots are never local
          botId
        );
        this.botSprites.set(botId, sprite);

        // Enable pointer interaction on bot sprite for NPC_INTERACT
        const gameObject = sprite.getGameObject();
        gameObject.setInteractive({ useHandCursor: true });
        gameObject.on('pointerdown', () => {
          if (this.room) {
            this.room.send(ClientMessage.NPC_INTERACT, { botId });
            console.log(
              `[PlayerManager] NPC_INTERACT sent: botId=${botId}`
            );
          }
        });

        // Subscribe to bot state changes
        const detachChange = $.onChange(bot, () => {
          sprite.setTarget(bot.worldX, bot.worldY);

          // Derive animation state from bot.state schema field
          // Server sends 'walking', client animation key expects 'walk'
          const animState = bot.state === 'walking' ? 'walk' : 'idle';
          sprite.updateAnimation(bot.direction || 'down', animState);
        });
        this.detachCallbacks.push(detachChange);

        console.log(
          `[PlayerManager] Bot added: ${botId}, skin: ${bot.skin}, name: ${bot.name}`
        );
      },
      true // immediate — fire for bots already in state
    );
    this.detachCallbacks.push(detachAdd);

    const detachRemove = $.onRemove(
      'bots' as never,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (_bot: any, botId: any) => {
        const sprite = this.botSprites.get(botId);
        if (sprite) {
          sprite.destroy();
          this.botSprites.delete(botId);
        }
        console.log(`[PlayerManager] Bot removed: ${botId}`);
      }
    );
    this.detachCallbacks.push(detachRemove);
  }

  private setupRoomEvents(): void {
    if (!this.room) return;

    this.room.onLeave((code) => {
      console.log(`[PlayerManager] Left room, code: ${code}`);
      if (!this.intentionalLeave) {
        EventBus.emit('multiplayer:disconnected', code);
      }
    });

    this.room.onError((code, message) => {
      console.error(`[PlayerManager] Room error: ${code} ${message}`);
      EventBus.emit('multiplayer:error', { code, message });
    });

    // NPC interaction result
    this.room.onMessage(
      ServerMessage.NPC_INTERACT_RESULT,
      (data: unknown) => {
        console.log('[PlayerManager] NPC_INTERACT_RESULT received:', data);
        EventBus.emit('npc:interact-result', data);
      }
    );

    // Dialogue events: forward server messages to EventBus for React consumption
    this.room.onMessage(
      ServerMessage.DIALOGUE_START,
      (data: DialogueStartWithRelationshipPayload) => {
        console.log(
          `[PlayerManager] DIALOGUE_START received: botId=${data.botId}, botName=${data.botName}`
        );
        EventBus.emit('dialogue:start', {
          botId: data.botId,
          botName: data.botName,
          relationship: data.relationship,
          availableActions: data.availableActions,
        });
      }
    );

    this.room.onMessage(
      ServerMessage.DIALOGUE_STREAM_CHUNK,
      (data: DialogueStreamChunkPayload) => {
        EventBus.emit('dialogue:stream-chunk', { text: data.text });
      }
    );

    this.room.onMessage(ServerMessage.DIALOGUE_END_TURN, () => {
      EventBus.emit('dialogue:end-turn');
    });
  }

  /**
   * Temporary diagnostics to debug bot visibility.
   * Polls room state to detect bots that arrived before callbacks were set up.
   */
  private setupBotDiagnostics(): void {
    if (!this.room) return;

    // Poll state every 2s for 10s to check for bots that callbacks may have missed
    let checks = 0;
    const interval = setInterval(() => {
      checks++;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const state = this.room?.state as any;
      const botsSize = state?.bots?.size ?? 0;
      console.log(
        `[PlayerManager:diag] check #${checks}: state.bots.size=${botsSize}, botSprites.size=${this.botSprites.size}`
      );
      if (botsSize > 0 && this.botSprites.size === 0) {
        console.warn(
          '[PlayerManager:diag] MISMATCH: bots exist in state but no sprites created!'
        );
        // Log bot details
        state.bots.forEach((bot: { worldX: number; worldY: number; skin: string; name: string; id: string }, key: string) => {
          console.warn(
            `[PlayerManager:diag] Bot in state: key=${key}, id=${bot.id}, name=${bot.name}, skin=${bot.skin}, pos=(${bot.worldX},${bot.worldY})`
          );
        });
      }
      if (checks >= 5) clearInterval(interval);
    }, 2000);
    this.detachCallbacks.push(() => clearInterval(interval));
  }

  destroy(): void {
    this.intentionalLeave = true;

    for (const detach of this.detachCallbacks) {
      detach();
    }
    this.detachCallbacks.length = 0;

    for (const sprite of this.sprites.values()) {
      sprite.destroy();
    }
    this.sprites.clear();

    // Clean up bot sprites
    for (const sprite of this.botSprites.values()) {
      sprite.destroy();
    }
    this.botSprites.clear();

    this.room = null;
    leaveCurrentRoom().catch(() => { /* fire-and-forget */ });
  }
}
