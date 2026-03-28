import { QdrantClient } from '@qdrant/js-client-rest';

const COLLECTION_NAME = 'npc_memories';
const VECTOR_SIZE = 768;
const DISTANCE_METRIC = 'Cosine' as const;

export interface VectorPayload {
  botId: string;
  userId: string | null;
  importance: number;
  createdAt: string; // ISO 8601
  [key: string]: unknown;
}

export class VectorStore {
  private readonly client: QdrantClient;

  constructor(options: { qdrantUrl: string; qdrantApiKey?: string }) {
    this.client = new QdrantClient({
      url: options.qdrantUrl,
      ...(options.qdrantApiKey && { apiKey: options.qdrantApiKey }),
    });
  }

  async ensureCollection(): Promise<void> {
    const { exists } = await this.client.collectionExists(COLLECTION_NAME);
    if (!exists) {
      await this.client.createCollection(COLLECTION_NAME, {
        vectors: {
          size: VECTOR_SIZE,
          distance: DISTANCE_METRIC,
        },
      });
    }
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

  async searchSimilar(
    queryVector: number[],
    botId: string,
    userId: string,
    limit: number
  ): Promise<{ id: string; score: number }[]> {
    const results = await this.client.search(COLLECTION_NAME, {
      vector: queryVector,
      limit,
      filter: {
        must: [
          { key: 'botId', match: { value: botId } },
          { key: 'userId', match: { value: userId } },
        ],
      },
    });

    return results.map((point) => ({
      id: String(point.id),
      score: point.score,
    }));
  }

  /**
   * Check which of the given memory IDs already have vectors in Qdrant.
   * Returns a Set of IDs that exist. Used by backfill to skip already-embedded memories.
   */
  async getExistingIds(ids: string[]): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    const points = await this.client.retrieve(COLLECTION_NAME, {
      ids,
      with_payload: false,
      with_vector: false,
    });
    return new Set(points.map((p) => String(p.id)));
  }

  async deleteMemoryVector(memoryId: string): Promise<void> {
    await this.client.delete(COLLECTION_NAME, {
      points: [memoryId],
    });
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.getCollections();
      return true;
    } catch {
      return false;
    }
  }
}
