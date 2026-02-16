import { describe, it, expect, beforeEach, afterAll } from '@jest/globals';
import { loadConfig } from './config.js';

describe('config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment before each test
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('required environment variables', () => {
    it('should throw descriptive error when AUTH_SECRET is missing', () => {
      delete process.env.AUTH_SECRET;
      process.env.DATABASE_URL = 'postgresql://localhost/test';

      expect(() => loadConfig()).toThrow(
        'AUTH_SECRET environment variable is required'
      );
    });

    it('should throw descriptive error when DATABASE_URL is missing', () => {
      process.env.AUTH_SECRET = 'test-secret-32-chars-minimum!!';
      delete process.env.DATABASE_URL;

      expect(() => loadConfig()).toThrow(
        'DATABASE_URL environment variable is required'
      );
    });
  });

  describe('default values', () => {
    it('should default COLYSEUS_PORT to 2567 when not set', () => {
      process.env.AUTH_SECRET = 'test-secret-32-chars-minimum!!';
      process.env.DATABASE_URL = 'postgresql://localhost/test';
      delete process.env.COLYSEUS_PORT;

      const config = loadConfig();

      expect(config.port).toBe(2567);
    });

    it('should default CORS_ORIGIN to http://localhost:3000 when not set', () => {
      process.env.AUTH_SECRET = 'test-secret-32-chars-minimum!!';
      process.env.DATABASE_URL = 'postgresql://localhost/test';
      delete process.env.CORS_ORIGIN;

      const config = loadConfig();

      expect(config.corsOrigin).toBe('http://localhost:3000');
    });
  });

  describe('custom values', () => {
    it('should use custom COLYSEUS_PORT when set', () => {
      process.env.AUTH_SECRET = 'test-secret-32-chars-minimum!!';
      process.env.DATABASE_URL = 'postgresql://localhost/test';
      process.env.COLYSEUS_PORT = '3000';

      const config = loadConfig();

      expect(config.port).toBe(3000);
    });

    it('should use custom CORS_ORIGIN when set', () => {
      process.env.AUTH_SECRET = 'test-secret-32-chars-minimum!!';
      process.env.DATABASE_URL = 'postgresql://localhost/test';
      process.env.CORS_ORIGIN = 'https://example.com';

      const config = loadConfig();

      expect(config.corsOrigin).toBe('https://example.com');
    });
  });

  describe('complete configuration', () => {
    it('should return complete ServerConfig when all variables set', () => {
      process.env.AUTH_SECRET = 'test-secret-32-chars-minimum!!';
      process.env.DATABASE_URL = 'postgresql://localhost/test';
      process.env.COLYSEUS_PORT = '2567';
      process.env.CORS_ORIGIN = 'http://localhost:3000';

      const config = loadConfig();

      expect(config).toEqual({
        authSecret: 'test-secret-32-chars-minimum!!',
        databaseUrl: 'postgresql://localhost/test',
        port: 2567,
        corsOrigin: 'http://localhost:3000',
      });
    });
  });

  describe('security', () => {
    it('should not expose AUTH_SECRET in error messages', () => {
      process.env.AUTH_SECRET = 'super-secret-value-should-not-appear';
      delete process.env.DATABASE_URL;

      try {
        loadConfig();
        fail('Should have thrown');
      } catch (error) {
        // Verify error message does NOT contain the actual secret
        expect((error as Error).message).not.toContain(
          'super-secret-value-should-not-appear'
        );
      }
    });
  });
});
