import { Module } from '@nestjs/common';
import { ReflectionService } from './reflection.service.js';
import { ReflectionScheduler } from './reflection.scheduler.js';

@Module({
  providers: [ReflectionService, ReflectionScheduler],
  exports: [ReflectionService],
})
export class ReflectionModule {}
