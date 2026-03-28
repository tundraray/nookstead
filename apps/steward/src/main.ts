/**
 * Steward -- NestJS worker process for scheduled NPC tasks.
 *
 * This app does NOT serve HTTP traffic. It bootstraps the NestJS
 * application context to activate @nestjs/schedule cron jobs and
 * then idles until the process is stopped.
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  app.enableShutdownHooks();

  Logger.log('Steward worker started', 'Bootstrap');
}

bootstrap();
