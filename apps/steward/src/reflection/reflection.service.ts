import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import type { NpcMemoryRow } from '@nookstead/db';
import {
  reflectionOutputSchema,
  type ReflectionOutput,
} from './reflection.schema.js';

const DEFAULT_MODEL = 'gpt-5-mini';
const REFLECTION_TIMEOUT_MS = 15_000;

export interface ReflectionInput {
  botId: string;
  botName: string;
  persona: {
    personality: string | null;
    role: string | null;
    bio: string | null;
    traits: string[] | null;
    goals: string[] | null;
    interests: string[] | null;
  };
  currentMood: string | null;
  currentMoodIntensity: number | null;
  memories: NpcMemoryRow[];
}

@Injectable()
export class ReflectionService {
  private readonly logger = new Logger(ReflectionService.name);

  constructor(private readonly configService: ConfigService) {}

  async generateReflection(
    input: ReflectionInput
  ): Promise<ReflectionOutput | null> {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    const openai = createOpenAI({ apiKey });
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      REFLECTION_TIMEOUT_MS
    );

    try {
      const memorySummary =
        input.memories.length === 0
          ? 'No interactions today.'
          : input.memories
              .map((m) => `- [${m.type}] ${m.content}`)
              .join('\n');

      const { object } = await generateObject({
        model: openai(DEFAULT_MODEL),
        schema: reflectionOutputSchema,
        abortSignal: controller.signal,
        prompt: [
          `You are ${input.botName}, ${input.persona.role ?? 'a resident'}.`,
          `Personality: ${input.persona.personality ?? 'friendly'}`,
          `Current mood: ${input.currentMood ?? 'neutral'} (intensity ${input.currentMoodIntensity ?? 5}/10)`,
          '',
          `Today's memories:\n${memorySummary}`,
          '',
          'Reflect on your day. Generate a summary, update your mood, and state your plan for tomorrow.',
        ].join('\n'),
      });

      return object;
    } catch (err) {
      this.logger.error(
        `[ReflectionService] generateReflection failed: botId=${input.botId}`,
        err
      );
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}
