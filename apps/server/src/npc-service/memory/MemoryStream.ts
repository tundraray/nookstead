import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import type { DrizzleClient, NpcMemoryRow } from '@nookstead/db';
import {
  createMemory,
  getDialogueSessionMessages,
  getMemoryCount,
  deleteOldestMemories,
} from '@nookstead/db';
import type { MemoryConfigValues } from '@nookstead/db';
import { scoreImportance, type ImportanceScorerConfig } from './ImportanceScorer';
import type { EmbeddingService } from './EmbeddingService';
import type { VectorStore } from './VectorStore';

const DEFAULT_MODEL = 'gpt-5-mini';
const SUMMARY_MAX_TOKENS = 150;
const SUMMARY_MAX_LENGTH = 500;
const SUMMARY_TIMEOUT_MS = 15_000;

export interface MemoryStreamOptions {
  apiKey: string;
  model?: string;
  embeddingService?: EmbeddingService | null;
  vectorStore?: VectorStore | null;
}

export interface CreateDialogueMemoryParams {
  db: DrizzleClient;
  botId: string;
  userId: string;
  dialogueSessionId: string;
  isFirstMeeting: boolean;
  botName: string;
  playerName: string;
  config: MemoryConfigValues;
}

export interface CreateActionMemoryParams {
  db: DrizzleClient;
  botId: string;
  userId: string;
  playerName: string;
  memoryTemplate: string;
  importance: number;
  dialogueSessionId?: string;
}

export class MemoryStream {
  private readonly openai: ReturnType<typeof createOpenAI>;
  private readonly model: string;
  private readonly embeddingService: EmbeddingService | null;
  private readonly vectorStore: VectorStore | null;

  constructor(options: MemoryStreamOptions) {
    this.openai = createOpenAI({ apiKey: options.apiKey });
    this.model = options.model ?? DEFAULT_MODEL;
    this.embeddingService = options.embeddingService ?? null;
    this.vectorStore = options.vectorStore ?? null;
  }

  /**
   * Create a memory record from a completed dialogue session.
   * 1. Load messages for the session
   * 2. Generate LLM summary
   * 3. Score importance
   * 4. Store memory
   * 5. Cleanup if over limit
   */
  async createDialogueMemory(params: CreateDialogueMemoryParams): Promise<void> {
    const {
      db,
      botId,
      userId,
      dialogueSessionId,
      isFirstMeeting,
      botName,
      playerName,
      config,
    } = params;

    // 1. Load messages
    const messages = await getDialogueSessionMessages(db, dialogueSessionId);
    if (messages.length === 0) {
      console.log('[MemoryStream] No messages in session, skipping memory creation');
      return;
    }

    // 2. Generate LLM summary
    const summary = await this.generateSummary(botName, playerName, messages);
    if (!summary || summary.trim().length === 0) {
      console.warn('[MemoryStream] Empty summary generated, skipping memory creation');
      return;
    }

    // 3. Score importance
    const importanceConfig: ImportanceScorerConfig = {
      firstMeeting: config.importanceFirstMeeting,
      normalDialogue: config.importanceNormalDialogue,
      emotionalDialogue: config.importanceEmotionalDialogue,
      giftReceived: config.importanceGiftReceived,
      questRelated: config.importanceQuestRelated,
    };
    const importance = scoreImportance(importanceConfig, { isFirstMeeting });

    // 4. Store memory
    const memory = await createMemory(db, {
      botId,
      userId,
      type: 'interaction',
      content: summary.slice(0, SUMMARY_MAX_LENGTH),
      importance,
      dialogueSessionId,
    });

    // Fire-and-forget: embed and upsert to vector store
    this._fireAndForgetEmbed(memory, botId, userId, importance);

    console.log(
      `[MemoryStream] Created memory for bot=${botId}, user=${userId}, importance=${importance}`
    );

    // 5. Cleanup if over limit
    const count = await getMemoryCount(db, botId);
    if (count > config.maxMemoriesPerNpc) {
      await deleteOldestMemories(db, botId, config.maxMemoriesPerNpc);
      console.log(
        `[MemoryStream] Cleaned up memories for bot=${botId}, kept=${config.maxMemoriesPerNpc}`
      );
    }
  }

  /**
   * Create a memory record from a dialogue action (gift, etc.).
   * No LLM call — uses the template directly.
   */
  async createActionMemory(params: CreateActionMemoryParams): Promise<void> {
    const {
      db,
      botId,
      userId,
      playerName,
      memoryTemplate,
      importance,
      dialogueSessionId,
    } = params;

    const content = memoryTemplate.replace('{player}', playerName);

    const memory = await createMemory(db, {
      botId,
      userId,
      type: 'gift',
      content,
      importance,
      dialogueSessionId,
    });

    // Fire-and-forget: embed and upsert to vector store
    this._fireAndForgetEmbed(memory, botId, userId, importance);

    console.log(
      `[MemoryStream] Created action memory for bot=${botId}, importance=${importance}`
    );
  }

  /**
   * Fire-and-forget: generate embedding and upsert to vector store.
   * Runs detached from the caller's async context -- errors are logged
   * but never propagate to the memory creation flow.
   */
  private _fireAndForgetEmbed(
    memory: NpcMemoryRow,
    botId: string,
    userId: string,
    importance: number
  ): void {
    if (!this.embeddingService || !this.vectorStore) return;

    const { embeddingService, vectorStore } = this;
    embeddingService
      .embedText(memory.content)
      .then((vector) => {
        if (vector === null) return;
        return vectorStore.upsertMemoryVector(memory.id, vector, {
          botId,
          userId,
          importance,
          createdAt: memory.createdAt.toISOString(),
        });
      })
      .catch((err: unknown) => {
        console.error('[MemoryStream] Failed to embed memory:', {
          memoryId: memory.id,
          error: err,
        });
      });
  }

  private async generateSummary(
    botName: string,
    playerName: string,
    messages: Array<{ role: string; content: string }>
  ): Promise<string> {
    const dialogue = messages
      .map((m) => `${m.role === 'user' ? playerName : botName}: ${m.content}`)
      .join('\n');

    const prompt = `Кратко перескажи этот диалог между NPC "${botName}" и игроком "${playerName}" в 1-2 предложениях от лица ${botName}. Сфокусируйся на ключевых фактах, эмоциях и примечательных деталях. Пиши на русском языке.\n\nДиалог:\n${dialogue}`;

    const abortController = new AbortController();
    const timeout = setTimeout(
      () => abortController.abort(),
      SUMMARY_TIMEOUT_MS
    );

    try {
      const { text } = await generateText({
        model: this.openai(this.model),
        maxOutputTokens: SUMMARY_MAX_TOKENS,
        prompt,
        abortSignal: abortController.signal,
      });
      return text.slice(0, SUMMARY_MAX_LENGTH);
    } catch (error) {
      console.error('[MemoryStream] Summary generation failed:', error);
      return '';
    } finally {
      clearTimeout(timeout);
    }
  }
}
