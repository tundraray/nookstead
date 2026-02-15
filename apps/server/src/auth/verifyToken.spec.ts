import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock jose module
jest.mock('jose', () => ({
  jwtDecrypt: jest.fn(),
}));

// Mock @panva/hkdf module
jest.mock('@panva/hkdf', () => ({
  hkdf: jest.fn(),
}));

// Import after mocks are declared (jest.mock is hoisted)
import { verifyNextAuthToken } from './verifyToken.js';
import { jwtDecrypt } from 'jose';
import type { JWTDecryptResult } from 'jose';
import { hkdf } from '@panva/hkdf';

/**
 * Type the mock to the first overload of jwtDecrypt (key-based, not getKey-based).
 * The second overload returns JWTDecryptResult & ResolvedKey which adds a `key`
 * property we do not need in tests.
 */
type JwtDecryptFn = (
  jwt: string | Uint8Array,
  key: unknown,
  options?: unknown
) => Promise<JWTDecryptResult>;

const mockedJwtDecrypt = jwtDecrypt as unknown as jest.MockedFunction<JwtDecryptFn>;
const mockedHkdf = hkdf as jest.MockedFunction<typeof hkdf>;

/** Minimal JWE protected header stub for mock return values */
const stubHeader = { alg: 'dir' as const, enc: 'A256CBC-HS512' as const };

describe('verifyToken', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: hkdf resolves with a 64-byte buffer
    mockedHkdf.mockResolvedValue(Buffer.alloc(64));
  });

  describe('verifyNextAuthToken', () => {
    describe('valid token', () => {
      it('should decode valid token and return TokenPayload', async () => {
        const mockPayload = {
          userId: 'user-123',
          email: 'test@example.com',
          sub: 'user-123',
          name: 'Test User',
          iat: 1700000000,
          exp: 1700003600,
          jti: 'jwt-id-abc',
        };

        mockedJwtDecrypt.mockResolvedValueOnce({
          payload: mockPayload,
          protectedHeader: stubHeader,
        });

        const result = await verifyNextAuthToken(
          'mock-token',
          'test-secret',
          false
        );

        expect(result.userId).toBe('user-123');
        expect(result.email).toBe('test@example.com');
        expect(result.sub).toBe('user-123');
        expect(result.name).toBe('Test User');
        expect(result.iat).toBe(1700000000);
        expect(result.exp).toBe(1700003600);
        expect(result.jti).toBe('jwt-id-abc');
      });

      it('should pass clockTolerance option to jwtDecrypt', async () => {
        const mockPayload = {
          userId: 'user-456',
          email: 'clock@example.com',
          sub: 'user-456',
        };

        mockedJwtDecrypt.mockResolvedValueOnce({
          payload: mockPayload,
          protectedHeader: stubHeader,
        });

        await verifyNextAuthToken('mock-token', 'test-secret', false);

        expect(mockedJwtDecrypt).toHaveBeenCalledWith(
          'mock-token',
          expect.any(Uint8Array),
          { clockTolerance: 15 }
        );
      });
    });

    describe('missing payload fields', () => {
      it('should throw when token payload missing userId', async () => {
        const mockPayload = {
          email: 'test@example.com',
          sub: 'user-123',
        };

        mockedJwtDecrypt.mockResolvedValueOnce({
          payload: mockPayload,
          protectedHeader: stubHeader,
        });

        await expect(
          verifyNextAuthToken('mock-token', 'test-secret', false)
        ).rejects.toThrow('Token payload missing userId');
      });

      it('should throw when userId is not a string', async () => {
        const mockPayload = {
          userId: 12345,
          email: 'test@example.com',
          sub: 'user-123',
        };

        mockedJwtDecrypt.mockResolvedValueOnce({
          payload: mockPayload,
          protectedHeader: stubHeader,
        });

        await expect(
          verifyNextAuthToken('mock-token', 'test-secret', false)
        ).rejects.toThrow('Token payload missing userId');
      });

      it('should throw when token payload missing email', async () => {
        const mockPayload = {
          userId: 'user-123',
          sub: 'user-123',
        };

        mockedJwtDecrypt.mockResolvedValueOnce({
          payload: mockPayload,
          protectedHeader: stubHeader,
        });

        await expect(
          verifyNextAuthToken('mock-token', 'test-secret', false)
        ).rejects.toThrow('Token payload missing email');
      });

      it('should throw when email is not a string', async () => {
        const mockPayload = {
          userId: 'user-123',
          email: true,
          sub: 'user-123',
        };

        mockedJwtDecrypt.mockResolvedValueOnce({
          payload: mockPayload,
          protectedHeader: stubHeader,
        });

        await expect(
          verifyNextAuthToken('mock-token', 'test-secret', false)
        ).rejects.toThrow('Token payload missing email');
      });
    });

    describe('jose errors', () => {
      it('should propagate JWTExpired error for expired token', async () => {
        const expiredError = new Error('JWTExpired');
        expiredError.name = 'JWTExpired';
        mockedJwtDecrypt.mockRejectedValueOnce(expiredError);

        await expect(
          verifyNextAuthToken('expired-token', 'test-secret', false)
        ).rejects.toThrow('JWTExpired');
      });

      it('should propagate JWEDecryptionFailed for invalid token format', async () => {
        const decryptError = new Error('JWEDecryptionFailed');
        decryptError.name = 'JWEDecryptionFailed';
        mockedJwtDecrypt.mockRejectedValueOnce(decryptError);

        await expect(
          verifyNextAuthToken('invalid-token', 'test-secret', false)
        ).rejects.toThrow('JWEDecryptionFailed');
      });
    });

    describe('cookie name selection', () => {
      it('should use __Secure-authjs.session-token for production', async () => {
        const mockPayload = {
          userId: 'user-123',
          email: 'test@example.com',
          sub: 'user-123',
        };

        mockedJwtDecrypt.mockResolvedValueOnce({
          payload: mockPayload,
          protectedHeader: stubHeader,
        });

        await verifyNextAuthToken('mock-token', 'test-secret', true);

        // Verify hkdf was called with production cookie name as salt (arg 3)
        // and in the info string (arg 4)
        expect(mockedHkdf).toHaveBeenCalledWith(
          'sha256',
          'test-secret',
          '__Secure-authjs.session-token',
          'Auth.js Generated Encryption Key (__Secure-authjs.session-token)',
          64
        );
      });

      it('should use authjs.session-token for development', async () => {
        const mockPayload = {
          userId: 'user-123',
          email: 'test@example.com',
          sub: 'user-123',
        };

        mockedJwtDecrypt.mockResolvedValueOnce({
          payload: mockPayload,
          protectedHeader: stubHeader,
        });

        await verifyNextAuthToken('mock-token', 'test-secret', false);

        // Verify hkdf was called with dev cookie name as salt (arg 3)
        // and in the info string (arg 4)
        expect(mockedHkdf).toHaveBeenCalledWith(
          'sha256',
          'test-secret',
          'authjs.session-token',
          'Auth.js Generated Encryption Key (authjs.session-token)',
          64
        );
      });
    });

    describe('key derivation', () => {
      it('should pass derived key as Uint8Array to jwtDecrypt', async () => {
        const mockDerivedKey = Buffer.from('a'.repeat(64));
        mockedHkdf.mockResolvedValueOnce(mockDerivedKey);

        const mockPayload = {
          userId: 'user-123',
          email: 'test@example.com',
          sub: 'user-123',
        };

        mockedJwtDecrypt.mockResolvedValueOnce({
          payload: mockPayload,
          protectedHeader: stubHeader,
        });

        await verifyNextAuthToken('mock-token', 'test-secret', false);

        // The second argument to jwtDecrypt should be a Uint8Array
        // constructed from the hkdf result
        const encryptionKey = mockedJwtDecrypt.mock.calls[0][1];
        expect(encryptionKey).toBeInstanceOf(Uint8Array);
      });
    });
  });
});
