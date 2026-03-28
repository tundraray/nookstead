import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '../config/config.module';
import { ReflectionModule } from '../reflection/reflection.module.js';

@Module({
  imports: [ScheduleModule.forRoot(), ConfigModule, ReflectionModule],
})
export class AppModule {}
