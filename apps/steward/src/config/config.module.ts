/**
 * Global configuration module for the steward worker.
 *
 * Loads environment variables via @nestjs/config and exposes them
 * globally so any module can inject `ConfigService`.
 *
 * Required env vars:
 * - `DATABASE_URL`           -- PostgreSQL connection string
 * - `OPENAI_API_KEY`         -- OpenAI API key for LLM calls
 * - `GOOGLE_GENERATIVE_AI_API_KEY` -- Google AI key for embeddings
 * - `QDRANT_URL`             -- Qdrant vector DB endpoint
 *
 * Optional env vars:
 * - `REFLECTION_CRON`        -- Cron expression (default: '0 4 * * *')
 */

import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
  ],
  exports: [NestConfigModule],
})
export class ConfigModule {}
