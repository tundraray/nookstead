import { Room, Client, type AuthContext } from 'colyseus';
import { GameRoomState, Player } from './GameRoomState';
import { verifyNextAuthToken } from '../auth/verifyToken';
import { loadConfig } from '../config';
import {
  TICK_INTERVAL_MS,
  PATCH_RATE_MS,
  ClientMessage,
  type MovePayload,
  type AuthData,
} from '@nookstead/shared';

export class GameRoom extends Room<{ state: GameRoomState }> {
  override async onAuth(
    _client: Client,
    options: Record<string, unknown>,
    _context: AuthContext
  ): Promise<AuthData> {
    const token = options['token'];
    if (!token || typeof token !== 'string') {
      throw new Error('No authentication token provided');
    }

    const config = loadConfig();
    const payload = await verifyNextAuthToken(token, config.authSecret);

    return {
      userId: payload.userId,
      email: payload.email,
    };
  }

  override onCreate(): void {
    this.setState(new GameRoomState());
    this.setPatchRate(PATCH_RATE_MS);
    this.setSimulationInterval(() => this.update(), TICK_INTERVAL_MS);

    this.onMessage(ClientMessage.MOVE, (client, payload: unknown) => {
      this.handleMove(client, payload);
    });

    console.log(`[GameRoom] Room created: ${this.roomId}`);
  }

  override onJoin(client: Client, _options: Record<string, unknown>, auth: AuthData): void {
    const player = new Player();
    player.userId = auth.userId;
    player.name = auth.email.split('@')[0];
    player.x = 0;
    player.y = 0;
    player.connected = true;

    this.state.players.set(client.sessionId, player);
    console.log(
      `[GameRoom] Player joined: sessionId=${client.sessionId}, userId=${auth.userId}`
    );
  }

  override onLeave(client: Client, code?: number): void {
    const player = this.state.players.get(client.sessionId);
    if (player) {
      console.log(
        `[GameRoom] Player left: sessionId=${client.sessionId}, userId=${player.userId}, code=${code}`
      );
      this.state.players.delete(client.sessionId);
    }
  }

  override onDispose(): void {
    console.log(`[GameRoom] Room disposed: ${this.roomId}`);
  }

  private update(): void {
    // Server tick — game logic runs here in future updates
  }

  private handleMove(client: Client, payload: unknown): void {
    if (
      !payload ||
      typeof payload !== 'object' ||
      typeof (payload as MovePayload).x !== 'number' ||
      typeof (payload as MovePayload).y !== 'number'
    ) {
      console.warn(
        `[GameRoom] Invalid move payload from sessionId=${client.sessionId}`
      );
      return;
    }

    const move = payload as MovePayload;
    const player = this.state.players.get(client.sessionId);
    if (player) {
      player.x = move.x;
      player.y = move.y;
    }
  }
}
