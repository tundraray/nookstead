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
      process.env.OPENAI_API_KEY = 'sk-test-key';

      expect(() => loadConfig()).toThrow(
        'AUTH_SECRET environment variable is required'
      );
    });

    it('should throw descriptive error when DATABASE_URL is missing', () => {
      process.env.AUTH_SECRET = 'test-secret-32-chars-minimum!!';
      delete process.env.DATABASE_URL;
      process.env.OPENAI_API_KEY = 'sk-test-key';

      expect(() => loadConfig()).toThrow(
        'DATABASE_URL environment variable is required'
      );
    });

    it('should throw descriptive error when OPENAI_API_KEY is missing', () => {
      process.env.AUTH_SECRET = 'test-secret-32-chars-minimum!!';
      process.env.DATABASE_URL = 'postgresql://localhost/test';
      delete process.env.OPENAI_API_KEY;

      expect(() => loadConfig()).toThrow(
        'OPENAI_API_KEY environment variable is required'
      );
    });
  });

  describe('default values', () => {
    it('should default COLYSEUS_PORT to 2567 when not set', () => {
      process.env.AUTH_SECRET = 'test-secret-32-chars-minimum!!';
      process.env.DATABASE_URL = 'postgresql://localhost/test';
      process.env.OPENAI_API_KEY = 'sk-test-key';
      delete process.env.COLYSEUS_PORT;

      const config = loadConfig();

      expect(config.port).toBe(2567);
    });

    it('should default CORS_ORIGIN to http://localhost:3000 when not set', () => {
      process.env.AUTH_SECRET = 'test-secret-32-chars-minimum!!';
      process.env.DATABASE_URL = 'postgresql://localhost/test';
      process.env.OPENAI_API_KEY = 'sk-test-key';
      delete process.env.CORS_ORIGIN;

      const config = loadConfig();

      expect(config.corsOrigin).toBe('http://localhost:3000');
    });
  });

  describe('custom values', () => {
    it('should use custom COLYSEUS_PORT when set', () => {
      process.env.AUTH_SECRET = 'test-secret-32-chars-minimum!!';
      process.env.DATABASE_URL = 'postgresql://localhost/test';
      process.env.OPENAI_API_KEY = 'sk-test-key';
      process.env.COLYSEUS_PORT = '3000';

      const config = loadConfig();

      expect(config.port).toBe(3000);
    });

    it('should use custom CORS_ORIGIN when set', () => {
      process.env.AUTH_SECRET = 'test-secret-32-chars-minimum!!';
      process.env.DATABASE_URL = 'postgresql://localhost/test';
      process.env.OPENAI_API_KEY = 'sk-test-key';
      process.env.CORS_ORIGIN = 'https://example.com';

      const config = loadConfig();

      expect(config.corsOrigin).toBe('https://example.com');
    });
  });

  describe('complete configuration', () => {
    it('should return complete ServerConfig when all variables set', () => {
      process.env.AUTH_SECRET = 'test-secret-32-chars-minimum!!';
      process.env.DATABASE_URL = 'postgresql://localhost/test';
      process.env.OPENAI_API_KEY = 'sk-test-key';
      process.env.COLYSEUS_PORT = '2567';
      process.env.CORS_ORIGIN = 'http://localhost:3000';

      const config = loadConfig();

      expect(config).toEqual({
        authSecret: 'test-secret-32-chars-minimum!!',
        databaseUrl: 'postgresql://localhost/test',
        openaiApiKey: 'sk-test-key',
        port: 2567,
        corsOrigin: 'http://localhost:3000',
        dayDurationSeconds: 86400,
        seasonDurationDays: 7,
      });
    });
  });

  describe('clock configuration', () => {
    const REQUIRED = {
      AUTH_SECRET: 'test-secret-32-chars-minimum!!',
      DATABASE_URL: 'postgresql://localhost/test',
      OPENAI_API_KEY: 'sk-test-key',
    };

    function setRequired() {
      Object.entries(REQUIRED).forEach(([k, v]) => {
        process.env[k] = v;
      });
    }

    it('should default GAME_DAY_DURATION_SECONDS to 86400 when not set (AC-1)', () => {
      setRequired();
      delete process.env.GAME_DAY_DURATION_SECONDS;

      const config = loadConfig();

      expect(config.dayDurationSeconds).toBe(86400);
    });

    it('should default GAME_SEASON_DURATION_DAYS to 7 when not set (AC-1)', () => {
      setRequired();
      delete process.env.GAME_SEASON_DURATION_DAYS;

      const config = loadConfig();

      expect(config.seasonDurationDays).toBe(7);
    });

    it('should use custom GAME_DAY_DURATION_SECONDS when set to valid value', () => {
      setRequired();
      process.env.GAME_DAY_DURATION_SECONDS = '1440';

      const config = loadConfig();

      expect(config.dayDurationSeconds).toBe(1440);
    });

    it('should clamp GAME_DAY_DURATION_SECONDS=0 to minimum 60 (AC-1.1)', () => {
      setRequired();
      process.env.GAME_DAY_DURATION_SECONDS = '0';

      const config = loadConfig();

      expect(config.dayDurationSeconds).toBe(60);
    });

    it('should clamp GAME_DAY_DURATION_SECONDS=999999 to maximum 604800 (AC-1.1)', () => {
      setRequired();
      process.env.GAME_DAY_DURATION_SECONDS = '999999';

      const config = loadConfig();

      expect(config.dayDurationSeconds).toBe(604800);
    });

    it('should clamp GAME_SEASON_DURATION_DAYS=0 to minimum 1 (AC-1.2)', () => {
      setRequired();
      process.env.GAME_SEASON_DURATION_DAYS = '0';

      const config = loadConfig();

      expect(config.seasonDurationDays).toBe(1);
    });

    it('should clamp GAME_SEASON_DURATION_DAYS=999 to maximum 365 (AC-1.2)', () => {
      setRequired();
      process.env.GAME_SEASON_DURATION_DAYS = '999';

      const config = loadConfig();

      expect(config.seasonDurationDays).toBe(365);
    });

    it('should use default 86400 when GAME_DAY_DURATION_SECONDS is non-numeric (AC-1)', () => {
      setRequired();
      process.env.GAME_DAY_DURATION_SECONDS = 'abc';

      const config = loadConfig();

      expect(config.dayDurationSeconds).toBe(86400);
    });
  });

  describe('security', () => {
    it('should not expose AUTH_SECRET in error messages', () => {
      process.env.AUTH_SECRET = 'super-secret-value-should-not-appear';
      delete process.env.DATABASE_URL;
      process.env.OPENAI_API_KEY = 'sk-test-key';

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
