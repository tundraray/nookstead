import { QdrantClient } from '@qdrant/js-client-rest';

const COLLECTION_NAME = 'npc_memories';

export interface VectorPayload {
  botId: string;
  userId: string | null;
  [key: string]: unknown;
}

/**
 * Lightweight vector store service for the steward worker.
 * Mirrors apps/server/src/npc-service/memory/VectorStore.ts
 * but is a standalone copy to respect Nx module boundaries.
 */
export class VectorStore {
  private readonly client: QdrantClient;

  constructor(options: { qdrantUrl: string }) {
    this.client = new QdrantClient({ url: options.qdrantUrl });
  }

  async upsertMemoryVector(
    memoryId: string,
    vector: number[],
    payload: VectorPayload
  ): Promise<void> {
    await this.client.upsert(COLLECTION_NAME, {
      points: [
        {
          id: memoryId,
          vector,
          payload,
        },
      ],
    });
  }
}
