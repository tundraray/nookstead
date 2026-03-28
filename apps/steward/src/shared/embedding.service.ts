import { embed } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

const EMBEDDING_MODEL = 'gemini-embedding-001';
const EMBEDDING_DIMENSIONS = 768;

/**
 * Lightweight embedding service for the steward worker.
 * Mirrors apps/server/src/npc-service/memory/EmbeddingService.ts
 * but is a standalone copy to respect Nx module boundaries.
 */
export class EmbeddingService {
  private readonly model: ReturnType<
    ReturnType<typeof createGoogleGenerativeAI>['embeddingModel']
  >;

  constructor(options: { googleApiKey: string }) {
    const google = createGoogleGenerativeAI({ apiKey: options.googleApiKey });
    this.model = google.embeddingModel(EMBEDDING_MODEL);
  }

  async embedText(text: string): Promise<number[] | null> {
    if (text.length === 0) return null;
    try {
      const { embedding } = await embed({
        model: this.model,
        value: text,
        providerOptions: {
          google: { outputDimensionality: EMBEDDING_DIMENSIONS },
        },
      });
      return embedding;
    } catch (error) {
      console.error('[EmbeddingService] embedText failed:', { error });
      return null;
    }
  }
}
