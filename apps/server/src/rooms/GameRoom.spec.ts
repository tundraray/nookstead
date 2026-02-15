import { describe, it, expect, jest, beforeEach } from '@jest/globals';

/* ------------------------------------------------------------------ */
/*  Captured message handlers from Room.onMessage registrations       */
/* ------------------------------------------------------------------ */
const messageHandlers = new Map<string, (client: unknown, payload: unknown) => void>();

/* ------------------------------------------------------------------ */
/*  Module mocks (hoisted by Jest before imports)                     */
/* ------------------------------------------------------------------ */
jest.mock('colyseus', () => {
  class MockRoom {
    state: unknown;
    roomId = 'test-room-id';

    setState(state: unknown): void {
      this.state = state;
    }

    setPatchRate(_rate: number): void {
      /* no-op */
    }

    setSimulationInterval(_cb: () => void, _interval: number): void {
      /* no-op */
    }

    onMessage(type: string, handler: (client: unknown, payload: unknown) => void): void {
      messageHandlers.set(type, handler);
    }
  }

  return {
    __esModule: true,
    Room: MockRoom,
  };
});

jest.mock('../config', () => ({
  __esModule: true,
  loadConfig: jest.fn().mockReturnValue({
    port: 2567,
    authSecret: 'test-secret',
    databaseUrl: 'postgres://test',
    corsOrigin: 'http://localhost:3000',
  }),
}));

jest.mock('../auth/verifyToken', () => ({
  __esModule: true,
  verifyNextAuthToken: jest.fn(),
}));

/* ------------------------------------------------------------------ */
/*  Imports (resolved after mocks are applied)                        */
/* ------------------------------------------------------------------ */
import { GameRoom } from './GameRoom';
import { verifyNextAuthToken } from '../auth/verifyToken';
import type { AuthData } from '@nookstead/shared';

/* ------------------------------------------------------------------ */
/*  Type aliases for readability                                      */
/* ------------------------------------------------------------------ */
interface MockClient {
  sessionId: string;
  send: jest.Mock;
}

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */
describe('GameRoom', () => {
  let room: GameRoom;
  let mockClient: MockClient;

  beforeEach(() => {
    messageHandlers.clear();
    jest.clearAllMocks();

    room = new GameRoom();
    mockClient = {
      sessionId: 'test-session-id',
      send: jest.fn(),
    };
  });

  /* ---------------------------------------------------------------- */
  /*  Player Join                                                     */
  /* ---------------------------------------------------------------- */
  describe('onJoin', () => {
    it('should add player to state with correct initial values', () => {
      const authData: AuthData = {
        userId: 'user-123',
        email: 'test@example.com',
      };

      room.onCreate();
      room.onJoin(mockClient as never, {}, authData);

      const player = room.state.players.get('test-session-id');
      expect(player).toBeDefined();
      expect(player?.userId).toBe('user-123');
      expect(player?.name).toBe('test');
      expect(player?.x).toBe(0);
      expect(player?.y).toBe(0);
      expect(player?.connected).toBe(true);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Player Leave                                                    */
  /* ---------------------------------------------------------------- */
  describe('onLeave', () => {
    it('should remove player from state on leave', () => {
      const authData: AuthData = {
        userId: 'user-123',
        email: 'test@example.com',
      };

      room.onCreate();
      room.onJoin(mockClient as never, {}, authData);

      expect(room.state.players.has('test-session-id')).toBe(true);

      room.onLeave(mockClient as never);

      expect(room.state.players.has('test-session-id')).toBe(false);
    });

    it('should handle leave for non-existent player gracefully', () => {
      room.onCreate();

      expect(() => room.onLeave(mockClient as never)).not.toThrow();
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Valid Move Message                                              */
  /* ---------------------------------------------------------------- */
  describe('handleMove (via onMessage)', () => {
    it('should update player position on valid move message', () => {
      const authData: AuthData = {
        userId: 'user-123',
        email: 'test@example.com',
      };

      room.onCreate();
      room.onJoin(mockClient as never, {}, authData);

      const moveHandler = messageHandlers.get('move');
      expect(moveHandler).toBeDefined();

      moveHandler!(mockClient, { x: 10, y: 20 });

      const player = room.state.players.get('test-session-id');
      expect(player?.x).toBe(10);
      expect(player?.y).toBe(20);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Invalid Move Message                                            */
  /* ---------------------------------------------------------------- */
  describe('handleMove with invalid payload', () => {
    it('should not update state when move payload has non-numeric coordinates', () => {
      const authData: AuthData = {
        userId: 'user-123',
        email: 'test@example.com',
      };

      room.onCreate();
      room.onJoin(mockClient as never, {}, authData);

      const player = room.state.players.get('test-session-id');
      const initialX = player?.x;
      const initialY = player?.y;

      const moveHandler = messageHandlers.get('move');
      moveHandler!(mockClient, { x: 'abc', y: 'def' });

      expect(player?.x).toBe(initialX);
      expect(player?.y).toBe(initialY);
    });

    it('should not update state when move payload is null', () => {
      const authData: AuthData = {
        userId: 'user-123',
        email: 'test@example.com',
      };

      room.onCreate();
      room.onJoin(mockClient as never, {}, authData);

      const player = room.state.players.get('test-session-id');
      const initialX = player?.x;
      const initialY = player?.y;

      const moveHandler = messageHandlers.get('move');
      moveHandler!(mockClient, null);

      expect(player?.x).toBe(initialX);
      expect(player?.y).toBe(initialY);
    });

    it('should not update state when move payload is missing fields', () => {
      const authData: AuthData = {
        userId: 'user-123',
        email: 'test@example.com',
      };

      room.onCreate();
      room.onJoin(mockClient as never, {}, authData);

      const player = room.state.players.get('test-session-id');
      const initialX = player?.x;
      const initialY = player?.y;

      const moveHandler = messageHandlers.get('move');
      moveHandler!(mockClient, { x: 10 });

      expect(player?.x).toBe(initialX);
      expect(player?.y).toBe(initialY);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Authentication                                                  */
  /* ---------------------------------------------------------------- */
  describe('onAuth', () => {
    it('should reject authentication when token is missing', async () => {
      room.onCreate();
      await expect(
        room.onAuth(mockClient as never, {}, {} as never)
      ).rejects.toThrow('No authentication token provided');
    });

    it('should reject authentication when token is not a string', async () => {
      room.onCreate();
      await expect(
        room.onAuth(mockClient as never, { token: 123 }, {} as never)
      ).rejects.toThrow('No authentication token provided');
    });

    it('should return AuthData on successful authentication', async () => {
      const mockPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        sub: 'user-123',
        iat: 1000,
        exp: 2000,
        jti: 'test-jti',
      };

      (verifyNextAuthToken as jest.MockedFunction<typeof verifyNextAuthToken>).mockResolvedValueOnce(mockPayload);

      room.onCreate();
      const result = await room.onAuth(mockClient as never, { token: 'valid-token' }, {} as never);

      expect(result).toEqual({
        userId: 'user-123',
        email: 'test@example.com',
      });
    });

    it('should propagate error when token verification fails', async () => {
      (verifyNextAuthToken as jest.MockedFunction<typeof verifyNextAuthToken>).mockRejectedValueOnce(
        new Error('Token verification failed')
      );

      room.onCreate();
      await expect(
        room.onAuth(mockClient as never, { token: 'bad-token' }, {} as never)
      ).rejects.toThrow('Token verification failed');
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Room Disposal                                                   */
  /* ---------------------------------------------------------------- */
  describe('onDispose', () => {
    it('should dispose room without errors', () => {
      room.onCreate();

      expect(() => room.onDispose()).not.toThrow();
    });
  });

  /* ---------------------------------------------------------------- */
  /*  onCreate registers message handlers                             */
  /* ---------------------------------------------------------------- */
  describe('onCreate', () => {
    it('should register a move message handler', () => {
      room.onCreate();

      expect(messageHandlers.has('move')).toBe(true);
    });
  });
});
