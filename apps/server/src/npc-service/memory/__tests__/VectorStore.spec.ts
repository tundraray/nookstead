import { describe, it, expect, beforeEach } from '@jest/globals';

const mockCollectionExists = jest.fn();
const mockCreateCollection = jest.fn();
const mockUpsert = jest.fn();
const mockSearch = jest.fn();
const mockDelete = jest.fn();
const mockGetCollections = jest.fn();
const mockRetrieve = jest.fn();

jest.mock('@qdrant/js-client-rest', () => ({
  QdrantClient: jest.fn().mockImplementation(() => ({
    collectionExists: mockCollectionExists,
    createCollection: mockCreateCollection,
    upsert: mockUpsert,
    search: mockSearch,
    delete: mockDelete,
    getCollections: mockGetCollections,
    retrieve: mockRetrieve,
  })),
}));

import { VectorStore } from '../VectorStore.js';

function make768Vector(fill = 0.1): number[] {
  return Array.from({ length: 768 }, () => fill);
}

describe('VectorStore', () => {
  let store: VectorStore;

  beforeEach(() => {
    jest.clearAllMocks();
    store = new VectorStore({ qdrantUrl: 'http://localhost:6333' });
  });

  describe('ensureCollection', () => {
    it('should create collection with dimension=768 and distance=Cosine when collection does not exist', async () => {
      mockCollectionExists.mockResolvedValue({ exists: false });
      mockCreateCollection.mockResolvedValue(true);

      await store.ensureCollection();

      expect(mockCollectionExists).toHaveBeenCalledWith('npc_memories');
      expect(mockCreateCollection).toHaveBeenCalledWith('npc_memories', {
        vectors: {
          size: 768,
          distance: 'Cosine',
        },
      });
    });

    it('should be a no-op when collection already exists', async () => {
      mockCollectionExists.mockResolvedValue({ exists: true });

      await store.ensureCollection();

      expect(mockCollectionExists).toHaveBeenCalledWith('npc_memories');
      expect(mockCreateCollection).not.toHaveBeenCalled();
    });
  });

  describe('upsertMemoryVector', () => {
    it('should call upsert with correct point structure', async () => {
      const vector = make768Vector(0.5);
      const payload = {
        botId: 'bot-1',
        userId: 'user-1',
        importance: 7,
        createdAt: '2026-03-14T12:00:00.000Z',
      };
      mockUpsert.mockResolvedValue({ status: 'completed' });

      await store.upsertMemoryVector('memory-uuid-123', vector, payload);

      expect(mockUpsert).toHaveBeenCalledWith('npc_memories', {
        points: [
          {
            id: 'memory-uuid-123',
            vector,
            payload,
          },
        ],
      });
    });
  });

  describe('searchSimilar', () => {
    it('should apply filter with must clause matching botId and userId and return results', async () => {
      const queryVector = make768Vector(0.3);
      mockSearch.mockResolvedValue([
        { id: 'mem-1', score: 0.95, payload: {} },
        { id: 'mem-2', score: 0.82, payload: {} },
      ]);

      const result = await store.searchSimilar(
        queryVector,
        'bot-1',
        'user-1',
        10
      );

      expect(mockSearch).toHaveBeenCalledWith('npc_memories', {
        vector: queryVector,
        limit: 10,
        filter: {
          must: [
            { key: 'botId', match: { value: 'bot-1' } },
            { key: 'userId', match: { value: 'user-1' } },
          ],
        },
      });
      expect(result).toEqual([
        { id: 'mem-1', score: 0.95 },
        { id: 'mem-2', score: 0.82 },
      ]);
    });

    it('should return empty array when no matches', async () => {
      const queryVector = make768Vector(0.3);
      mockSearch.mockResolvedValue([]);

      const result = await store.searchSimilar(
        queryVector,
        'bot-1',
        'user-1',
        10
      );

      expect(result).toEqual([]);
    });
  });

  describe('getExistingIds', () => {
    it('should return a Set of IDs that exist in Qdrant', async () => {
      mockRetrieve.mockResolvedValue([
        { id: 'mem-1' },
        { id: 'mem-3' },
      ]);

      const result = await store.getExistingIds(['mem-1', 'mem-2', 'mem-3']);

      expect(mockRetrieve).toHaveBeenCalledWith('npc_memories', {
        ids: ['mem-1', 'mem-2', 'mem-3'],
        with_payload: false,
        with_vector: false,
      });
      expect(result).toEqual(new Set(['mem-1', 'mem-3']));
    });

    it('should return empty Set when no IDs exist', async () => {
      mockRetrieve.mockResolvedValue([]);

      const result = await store.getExistingIds(['mem-1', 'mem-2']);

      expect(result).toEqual(new Set());
    });

    it('should return empty Set when given empty array without calling Qdrant', async () => {
      const result = await store.getExistingIds([]);

      expect(result).toEqual(new Set());
      expect(mockRetrieve).not.toHaveBeenCalled();
    });
  });

  describe('deleteMemoryVector', () => {
    it('should call delete with the correct point ID', async () => {
      mockDelete.mockResolvedValue({ status: 'completed' });

      await store.deleteMemoryVector('memory-uuid-456');

      expect(mockDelete).toHaveBeenCalledWith('npc_memories', {
        points: ['memory-uuid-456'],
      });
    });
  });

  describe('healthCheck', () => {
    it('should return true when Qdrant responds', async () => {
      mockGetCollections.mockResolvedValue({ collections: [] });

      const result = await store.healthCheck();

      expect(result).toBe(true);
    });

    it('should return false when Qdrant throws', async () => {
      mockGetCollections.mockRejectedValue(new Error('Connection refused'));

      const result = await store.healthCheck();

      expect(result).toBe(false);
    });
  });
});
