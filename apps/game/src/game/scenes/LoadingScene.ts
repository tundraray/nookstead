import { Scene } from 'phaser';
import { EventBus } from '../EventBus';
import { joinChunkRoom, leaveCurrentRoom } from '../../services/colyseus';
import { ServerMessage, LOADING_TIMEOUT_MS } from '@nookstead/shared';
import type { MapDataPayload, GameClockConfig } from '@nookstead/shared';
import type { Room } from '@colyseus/sdk';

type LoadingState =
  | 'CONNECTING'
  | 'LOADING_MAP'
  | 'LOADING_PLAYERS'
  | 'READY'
  | 'ERROR'
  | 'RETRYING';

const STATUS_TEXT: Record<LoadingState, string> = {
  CONNECTING: 'Connecting...',
  LOADING_MAP: 'Loading map...',
  LOADING_PLAYERS: 'Loading players...',
  READY: 'Ready!',
  ERROR: 'Connection failed. Please try again.',
  RETRYING: 'Retrying...',
};

export class LoadingScene extends Scene {
  private statusText!: Phaser.GameObjects.Text;
  private retryButton!: Phaser.GameObjects.Text;
  private state: LoadingState = 'CONNECTING';
  private room: Room | null = null;
  private mapData: MapDataPayload | null = null;
  private clockConfig: GameClockConfig | null = null;
  private timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    super({ key: 'Loading' });
  }

  create(): void {
    console.log('[LoadingScene] State: CONNECTING');

    const { width, height } = this.scale;

    // Status text centered on screen
    this.statusText = this.add
      .text(width / 2, height / 2 - 20, STATUS_TEXT.CONNECTING, {
        fontFamily: '"Press Start 2P"',
        fontSize: '16px',
        color: '#ffffff',
        resolution: 4,
      })
      .setOrigin(0.5);

    // Retry button (hidden initially)
    this.retryButton = this.add
      .text(width / 2, height / 2 + 40, 'Retry', {
        fontFamily: '"Press Start 2P"',
        fontSize: '14px',
        color: '#ffff00',
        backgroundColor: '#333333',
        padding: { x: 16, y: 8 },
        resolution: 4,
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => this.handleRetry())
      .setVisible(false);

    // Emit current-scene event for React wrapper (existing pattern)
    EventBus.emit('current-scene-ready', this);

    // Start the connection flow
    this.startConnecting();
  }

  private async startConnecting(): Promise<void> {
    this.setState('CONNECTING');
    this.startTimeout();

    try {
      this.room = await joinChunkRoom();
      this.clearTimeoutHandle();
      this.setState('LOADING_MAP');
      this.startTimeout();

      this.setupRoomListeners();
    } catch (err) {
      console.error('[LoadingScene] Room join failed:', err);
      this.clearTimeoutHandle();
      this.setState('ERROR', 'Connection failed');
    }
  }

  private setupRoomListeners(): void {
    if (!this.room) return;

    // Listen for ROOM_REDIRECT (wrong chunk — rejoin correct one)
    this.room.onMessage(
      ServerMessage.ROOM_REDIRECT,
      async (data: { chunkId: string }) => {
        console.log(
          `[LoadingScene] ROOM_REDIRECT received, target=${data.chunkId}`
        );
        this.clearTimeoutHandle();

        try {
          await leaveCurrentRoom(false);
          this.room = await joinChunkRoom(data.chunkId);
          this.setState('LOADING_MAP');
          this.startTimeout();
          this.setupRoomListeners();
        } catch (err) {
          console.error('[LoadingScene] Redirect join failed:', err);
          this.setState('ERROR', 'Redirect failed');
        }
      }
    );

    // Listen for MAP_DATA message
    this.room.onMessage(
      ServerMessage.MAP_DATA,
      (data: MapDataPayload) => {
        console.log('[LoadingScene] MAP_DATA received');
        this.mapData = data;
        this.tryProceed();
      }
    );

    // Listen for CLOCK_CONFIG (sent immediately after MAP_DATA)
    this.room.onMessage(
      ServerMessage.CLOCK_CONFIG,
      (data: GameClockConfig) => {
        console.log('[LoadingScene] CLOCK_CONFIG received');
        this.clockConfig = data;
        this.tryProceed();
      }
    );

    // Listen for ERROR message from server
    this.room.onMessage(
      ServerMessage.ERROR,
      (data: { message: string }) => {
        console.error('[LoadingScene] Server error:', data.message);
        this.clearTimeoutHandle();
        this.setState('ERROR', data.message);
      }
    );
  }

  /**
   * Called after MAP_DATA or CLOCK_CONFIG arrives.
   * Proceeds only when both are available.
   */
  private tryProceed(): void {
    if (!this.mapData || !this.clockConfig) return;
    this.clearTimeoutHandle();
    this.setState('LOADING_PLAYERS');
    this.waitForPlayers();
  }

  private waitForPlayers(): void {
    this.startTimeout();

    if (!this.room) {
      this.setState('ERROR', 'Room lost');
      return;
    }

    // If state schema is already populated (no other players), go to READY
    const players = this.room.state?.players;
    if (!players || players.size === 0) {
      // No other players or schema not yet ready -- wait briefly, then proceed
      this.time.delayedCall(100, () => {
        this.clearTimeoutHandle();
        this.setState('READY');
        this.transitionToGame();
      });
    } else {
      // Players already present
      this.clearTimeoutHandle();
      this.setState('READY');
      this.transitionToGame();
    }

    // Also handle state population via onStateChange
    this.room.onStateChange.once(() => {
      if (this.state === 'LOADING_PLAYERS') {
        this.clearTimeoutHandle();
        this.setState('READY');
        this.transitionToGame();
      }
    });
  }

  private transitionToGame(): void {
    if (!this.mapData || !this.room) {
      this.setState('ERROR', 'Map data missing');
      return;
    }

    console.log('[LoadingScene] State: READY, transitioning to Game');

    // Pass mapData, room, and clockConfig to Game scene via Phaser scene init data
    this.scene.start('Game', { mapData: this.mapData, room: this.room, clockConfig: this.clockConfig });
  }

  private handleRetry(): void {
    console.log('[LoadingScene] Retry requested');
    this.setState('RETRYING');
    this.retryButton.setVisible(false);

    // Cleanup existing room if any
    if (this.room) {
      leaveCurrentRoom(false).catch(() => {
        /* intentional: best-effort cleanup */
      });
      this.room = null;
    }
    this.mapData = null;
    this.clockConfig = null;
    this.clearTimeoutHandle();

    // Restart connection flow
    this.startConnecting();
  }

  private setState(newState: LoadingState, errorMessage?: string): void {
    this.state = newState;
    console.log(`[LoadingScene] State: ${newState}`);

    const text = errorMessage || STATUS_TEXT[newState];
    this.statusText.setText(text);

    // Show/hide retry button
    this.retryButton.setVisible(newState === 'ERROR');

    EventBus.emit('loading-state-change', { state: newState });
  }

  private startTimeout(): void {
    this.clearTimeoutHandle();
    this.timeoutHandle = setTimeout(() => {
      console.warn('[LoadingScene] Timeout reached, showing error');
      this.setState('ERROR', 'Loading timed out. Please try again.');
    }, LOADING_TIMEOUT_MS);
  }

  private clearTimeoutHandle(): void {
    if (this.timeoutHandle !== null) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }
  }

  // Called when this scene is shut down (e.g., when Game scene starts)
  shutdown(): void {
    this.clearTimeoutHandle();
  }
}
