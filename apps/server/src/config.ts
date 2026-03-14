import {
  COLYSEUS_PORT,
  DEFAULT_DAY_DURATION_SECONDS,
  DEFAULT_SEASON_DURATION_DAYS,
  MIN_DAY_DURATION_SECONDS,
  MAX_DAY_DURATION_SECONDS,
  MIN_SEASON_DURATION_DAYS,
  MAX_SEASON_DURATION_DAYS,
} from '@nookstead/shared';

export interface ServerConfig {
  port: number;
  authSecret: string;
  databaseUrl: string;
  corsOrigin: string;
  openaiApiKey: string;
  gameEpoch: number;
  dayDurationSeconds: number;
  seasonDurationDays: number;
}

export function loadConfig(): ServerConfig {
  const authSecret = process.env['AUTH_SECRET'];
  if (!authSecret) {
    throw new Error(
      'AUTH_SECRET environment variable is required. Set it to the same value used by NextAuth.'
    );
  }

  const databaseUrl = process.env['DATABASE_URL'];
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL environment variable is required. Set it to a PostgreSQL connection string.'
    );
  }

  const openaiApiKey = process.env['OPENAI_API_KEY'];
  if (!openaiApiKey) {
    throw new Error(
      'OPENAI_API_KEY environment variable is required. Set it to your OpenAI API key.'
    );
  }

  const port = parseInt(process.env['COLYSEUS_PORT'] ?? '', 10) || COLYSEUS_PORT;
  const corsOrigin = process.env['CORS_ORIGIN'] ?? 'http://localhost:3000';

  // GAME_EPOCH: Unix timestamp (seconds) marking Day 1 00:00 of the game world.
  // Default 0 = Unix epoch, so at default dayDuration (86400s) game time = UTC time.
  // Example: 1773439200 = some future date, days/time count from that moment.
  const rawGameEpoch = parseInt(process.env['GAME_EPOCH'] ?? '', 10);
  const gameEpoch = isNaN(rawGameEpoch) ? 0 : rawGameEpoch;

  const rawDayDuration = parseInt(process.env['GAME_DAY_DURATION_SECONDS'] ?? '', 10);
  const dayDurationSeconds = Math.min(
    MAX_DAY_DURATION_SECONDS,
    Math.max(
      MIN_DAY_DURATION_SECONDS,
      isNaN(rawDayDuration) ? DEFAULT_DAY_DURATION_SECONDS : rawDayDuration
    )
  );

  const rawSeasonDuration = parseInt(process.env['GAME_SEASON_DURATION_DAYS'] ?? '', 10);
  const seasonDurationDays = Math.min(
    MAX_SEASON_DURATION_DAYS,
    Math.max(
      MIN_SEASON_DURATION_DAYS,
      isNaN(rawSeasonDuration) ? DEFAULT_SEASON_DURATION_DAYS : rawSeasonDuration
    )
  );

  return { port, authSecret, databaseUrl, corsOrigin, openaiApiKey, gameEpoch, dayDurationSeconds, seasonDurationDays };
}
