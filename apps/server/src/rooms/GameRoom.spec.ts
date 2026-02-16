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
import { AVAILABLE_SKINS, type AuthData } from '@nookstead/shared';

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

    it('should assign a non-empty skin from AVAILABLE_SKINS on join', () => {
      const authData: AuthData = {
        userId: 'user-123',
        email: 'test@example.com',
      };

      room.onCreate();
      room.onJoin(mockClient as never, {}, authData);

      const player = room.state.players.get('test-session-id');
      expect(player).toBeDefined();
      expect(player?.skin).not.toBe('');
      expect(AVAILABLE_SKINS).toContain(player?.skin);
    });

    it('should set default direction to down and animState to idle on join', () => {
      const authData: AuthData = {
        userId: 'user-123',
        email: 'test@example.com',
      };

      room.onCreate();
      room.onJoin(mockClient as never, {}, authData);

      const player = room.state.players.get('test-session-id');
      expect(player).toBeDefined();
      expect(player?.direction).toBe('down');
      expect(player?.animState).toBe('idle');
    });

    it('should assign skin from AVAILABLE_SKINS for multiple players', () => {
      const authData1: AuthData = {
        userId: 'user-1',
        email: 'user1@example.com',
      };
      const authData2: AuthData = {
        userId: 'user-2',
        email: 'user2@example.com',
      };

      const mockClient2: MockClient = {
        sessionId: 'test-session-id-2',
        send: jest.fn(),
      };

      room.onCreate();
      room.onJoin(mockClient as never, {}, authData1);
      room.onJoin(mockClient2 as never, {}, authData2);

      const player1 = room.state.players.get('test-session-id');
      const player2 = room.state.players.get('test-session-id-2');

      expect(AVAILABLE_SKINS).toContain(player1?.skin);
      expect(AVAILABLE_SKINS).toContain(player2?.skin);
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
  /*  handlePositionUpdate (via onMessage)                            */
  /* ---------------------------------------------------------------- */
  describe('handlePositionUpdate (via onMessage)', () => {
    it('should update player position, direction, and animState on valid payload', () => {
      const authData: AuthData = {
        userId: 'user-123',
        email: 'test@example.com',
      };

      room.onCreate();
      room.onJoin(mockClient as never, {}, authData);

      const positionHandler = messageHandlers.get('position_update');
      expect(positionHandler).toBeDefined();

      positionHandler!(mockClient, {
        x: 150,
        y: 200,
        direction: 'right',
        animState: 'walk',
      });

      const player = room.state.players.get('test-session-id');
      expect(player?.x).toBe(150);
      expect(player?.y).toBe(200);
      expect(player?.direction).toBe('right');
      expect(player?.animState).toBe('walk');
    });

    it('should not update state when payload has non-numeric x', () => {
      const authData: AuthData = {
        userId: 'user-123',
        email: 'test@example.com',
      };

      room.onCreate();
      room.onJoin(mockClient as never, {}, authData);

      const player = room.state.players.get('test-session-id');
      const initialX = player?.x;
      const initialY = player?.y;

      const positionHandler = messageHandlers.get('position_update');
      positionHandler!(mockClient, {
        x: 'bad',
        y: 200,
        direction: 'right',
        animState: 'walk',
      });

      expect(player?.x).toBe(initialX);
      expect(player?.y).toBe(initialY);
    });

    it('should not update state when payload is missing direction', () => {
      const authData: AuthData = {
        userId: 'user-123',
        email: 'test@example.com',
      };

      room.onCreate();
      room.onJoin(mockClient as never, {}, authData);

      const player = room.state.players.get('test-session-id');
      const initialDirection = player?.direction;

      const positionHandler = messageHandlers.get('position_update');
      positionHandler!(mockClient, {
        x: 150,
        y: 200,
        animState: 'walk',
      });

      expect(player?.direction).toBe(initialDirection);
    });

    it('should not update state when payload is null', () => {
      const authData: AuthData = {
        userId: 'user-123',
        email: 'test@example.com',
      };

      room.onCreate();
      room.onJoin(mockClient as never, {}, authData);

      const player = room.state.players.get('test-session-id');
      const initialX = player?.x;
      const initialY = player?.y;

      const positionHandler = messageHandlers.get('position_update');
      positionHandler!(mockClient, null);

      expect(player?.x).toBe(initialX);
      expect(player?.y).toBe(initialY);
    });

    it('should not update state when payload is missing animState', () => {
      const authData: AuthData = {
        userId: 'user-123',
        email: 'test@example.com',
      };

      room.onCreate();
      room.onJoin(mockClient as never, {}, authData);

      const player = room.state.players.get('test-session-id');
      const initialAnimState = player?.animState;

      const positionHandler = messageHandlers.get('position_update');
      positionHandler!(mockClient, {
        x: 150,
        y: 200,
        direction: 'right',
      });

      expect(player?.animState).toBe(initialAnimState);
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

    it('should register a position_update message handler', () => {
      room.onCreate();

      expect(messageHandlers.has('position_update')).toBe(true);
    });
  });
});
