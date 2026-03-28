import type { DrizzleClient } from '@nookstead/db';
import { getAllMemoriesForBackfill } from '@nookstead/db';
import type { EmbeddingService } from './EmbeddingService';
import type { VectorStore } from './VectorStore';

export interface BackfillResult {
  total: number;
  embedded: number;
  failed: number;
  skipped: number;
  durationMs: number;
}

/**
 * Batch-embed existing PostgreSQL memories that lack Qdrant vectors.
 *
 * Designed to be callable from CLI, admin API, or a scheduled trigger.
 * Handles partial failures gracefully: individual embedding failures are
 * counted but do not abort the overall process.
 */
export async function backfillMemoryEmbeddings(params: {
  embeddingService: EmbeddingService;
  vectorStore: VectorStore;
  db: DrizzleClient;
  batchSize?: number;
  delayMs?: number;
}): Promise<BackfillResult> {
  const {
    embeddingService,
    vectorStore,
    db,
    batchSize = 10,
    delayMs = 1000,
  } = params;
  const startTime = Date.now();
  let embedded = 0;
  let failed = 0;
  let skipped = 0;

  const memories = await getAllMemoriesForBackfill(db);
  const total = memories.length;

  if (total === 0) {
    return { total: 0, embedded: 0, failed: 0, skipped: 0, durationMs: Date.now() - startTime };
  }

  const totalBatches = Math.ceil(total / batchSize);

  for (let i = 0; i < total; i += batchSize) {
    const batch = memories.slice(i, i + batchSize);
    const batchIndex = Math.floor(i / batchSize) + 1;

    // Check which memory IDs already have vectors in Qdrant
    const batchIds = batch.map((m) => m.id);
    const existing = await vectorStore.getExistingIds(batchIds);
    const toEmbed = batch.filter((m) => !existing.has(m.id));
    skipped += batch.length - toEmbed.length;

    if (toEmbed.length > 0) {
      // Batch-embed the missing memories
      const vectors = await embeddingService.embedTexts(
        toEmbed.map((m) => m.content)
      );

      // Upsert successful embeddings, count failures
      for (let j = 0; j < toEmbed.length; j++) {
        const vector = vectors[j];
        const memory = toEmbed[j];
        if (vector !== null && memory) {
          await vectorStore.upsertMemoryVector(memory.id, vector, {
            botId: memory.botId,
            userId: memory.userId,
            importance: memory.importance,
            createdAt: memory.createdAt.toISOString(),
          });
          embedded++;
        } else {
          failed++;
        }
      }
    }

    console.log(
      `[Backfill] Batch ${batchIndex}/${totalBatches}: embedded=${embedded}, failed=${failed}, skipped=${skipped}`
    );

    // Rate limiting delay between batches (skip after last batch)
    if (i + batchSize < total && delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return { total, embedded, failed, skipped, durationMs: Date.now() - startTime };
}
