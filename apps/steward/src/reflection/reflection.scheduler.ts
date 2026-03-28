import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import {
  eq,
  getGameDb,
  getBotsNeedingReflection,
  getRecentMemoriesForBot,
  createReflectionMemory,
  npcBots,
  type DrizzleClient,
} from '@nookstead/db';
import { ReflectionService } from './reflection.service.js';
import { EmbeddingService } from '../shared/embedding.service.js';
import { VectorStore } from '../shared/vector-store.service.js';

@Injectable()
export class ReflectionScheduler {
  private readonly logger = new Logger(ReflectionScheduler.name);
  private isRunning = false;

  constructor(
    private readonly reflectionService: ReflectionService,
    private readonly configService: ConfigService
  ) {}

  @Cron(process.env['REFLECTION_CRON'] ?? '0 4 * * *')
  async handleCron(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn(
        '[ReflectionScheduler] Already running, skipping this tick'
      );
      return;
    }
    await this.runOnce();
  }

  async runOnce(): Promise<void> {
    this.isRunning = true;
    try {
      const db = getGameDb();
      const startOfToday = new Date();
      startOfToday.setUTCHours(0, 0, 0, 0);

      const bots = await getBotsNeedingReflection(db, startOfToday);
      this.logger.log(
        `[ReflectionScheduler] Processing ${bots.length} bots`
      );

      for (const bot of bots) {
        await this.reflectBot(db, bot);
      }

      this.logger.log('[ReflectionScheduler] Done');
    } finally {
      this.isRunning = false;
    }
  }

  private async reflectBot(
    db: DrizzleClient,
    bot: { id: string; name: string }
  ): Promise<void> {
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const [botRow, memories] = await Promise.all([
        db.query.npcBots.findFirst({
          where: (b, { eq: eqFn }) => eqFn(b.id, bot.id),
        }),
        getRecentMemoriesForBot(db, bot.id, since),
      ]);

      if (!botRow) {
        this.logger.warn(
          `[ReflectionScheduler] Bot not found: ${bot.id}`
        );
        return;
      }

      const output = await this.reflectionService.generateReflection({
        botId: bot.id,
        botName: bot.name,
        persona: {
          personality: botRow.personality,
          role: botRow.role,
          bio: botRow.bio,
          traits: botRow.traits,
          goals: botRow.goals,
          interests: botRow.interests,
        },
        currentMood: botRow.mood,
        currentMoodIntensity: botRow.moodIntensity,
        memories,
      });

      if (!output) {
        this.logger.error(
          `[ReflectionScheduler] Reflection generation failed: botId=${bot.id}`,
          'null output from service'
        );
        return;
      }

      const content = [
        `[Day reflection] ${output.summary}`,
        `\nMood: ${output.mood} (intensity ${output.moodIntensity}/10) - ${output.moodRationale}`,
        `\nPlan for tomorrow: ${output.plan}`,
      ].join('');

      const memoryRow = await createReflectionMemory(db, {
        botId: bot.id,
        content,
        importance: 10,
      });

      // Update mood on npc_bots (raw Drizzle -- UpdateBotData excludes mood fields)
      await db
        .update(npcBots)
        .set({
          mood: output.mood,
          moodIntensity: output.moodIntensity,
          moodUpdatedAt: new Date(),
        })
        .where(eq(npcBots.id, bot.id));

      // Fire-and-forget: embed reflection content
      this.fireAndForgetEmbed(memoryRow.id, content, bot.id);

      this.logger.log(
        `[ReflectionScheduler] Reflected: botId=${bot.id} mood=${output.mood}`
      );
    } catch (err) {
      this.logger.error(
        `[ReflectionScheduler] Error for botId=${bot.id}`,
        err
      );
    }
  }

  private fireAndForgetEmbed(
    memoryId: string,
    content: string,
    botId: string
  ): void {
    const googleApiKey =
      this.configService.get<string>('GOOGLE_GENERATIVE_AI_API_KEY') ?? '';
    const qdrantUrl =
      this.configService.get<string>('QDRANT_URL') ?? '';

    if (!googleApiKey || !qdrantUrl) {
      this.logger.warn(
        `[ReflectionScheduler] Embedding skipped (missing config): memoryId=${memoryId}`
      );
      return;
    }

    const embeddingService = new EmbeddingService({ googleApiKey });
    const vectorStore = new VectorStore({ qdrantUrl });

    embeddingService
      .embedText(content)
      .then((vector) => {
        if (!vector) return;
        return vectorStore.upsertMemoryVector(memoryId, vector, {
          botId,
          userId: 'system',
          content,
          type: 'reflection',
        });
      })
      .catch((err) => {
        this.logger.warn(
          `[ReflectionScheduler] Embedding failed (non-critical): memoryId=${memoryId}`,
          err
        );
      });
  }
}
