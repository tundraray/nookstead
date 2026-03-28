import { describe, it, expect, beforeEach } from '@jest/globals';

const mockEmbed = jest.fn();
const mockEmbedMany = jest.fn();
jest.mock('ai', () => ({
  embed: mockEmbed,
  embedMany: mockEmbedMany,
}));

const mockEmbeddingModel = jest.fn();
jest.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: jest.fn().mockReturnValue({
    embeddingModel: mockEmbeddingModel,
  }),
}));

import { EmbeddingService } from '../EmbeddingService.js';

function make768Vector(fill = 0.1): number[] {
  return Array.from({ length: 768 }, () => fill);
}

describe('EmbeddingService', () => {
  let service: EmbeddingService;
  const fakeModel = { modelId: 'gemini-embedding-001' };

  beforeEach(() => {
    jest.clearAllMocks();
    mockEmbeddingModel.mockReturnValue(fakeModel);
    service = new EmbeddingService({ googleApiKey: 'test-api-key' });
  });

  describe('embedText', () => {
    it('should return 768-element array on successful API call', async () => {
      const expectedVector = make768Vector(0.5);
      mockEmbed.mockResolvedValue({ embedding: expectedVector });

      const result = await service.embedText('Hello, world!');

      expect(result).toEqual(expectedVector);
      expect(result).toHaveLength(768);
      expect(mockEmbed).toHaveBeenCalledTimes(1);
      expect(mockEmbed).toHaveBeenCalledWith(
        expect.objectContaining({
          model: fakeModel,
          value: 'Hello, world!',
        })
      );
    });

    it('should return null and NOT throw when API call throws', async () => {
      mockEmbed.mockRejectedValue(new Error('API rate limit exceeded'));

      const result = await service.embedText('some text');

      expect(result).toBeNull();
    });

    it('should return null without calling API when text is empty string', async () => {
      const result = await service.embedText('');

      expect(result).toBeNull();
      expect(mockEmbed).not.toHaveBeenCalled();
    });
  });

  describe('embedTexts', () => {
    it('should return array of 768-element arrays on success', async () => {
      const vectors = [make768Vector(0.1), make768Vector(0.2), make768Vector(0.3)];
      mockEmbedMany.mockResolvedValue({ embeddings: vectors });

      const result = await service.embedTexts(['text1', 'text2', 'text3']);

      expect(result).toEqual(vectors);
      expect(result).toHaveLength(3);
      result.forEach((v) => {
        expect(v).toHaveLength(768);
      });
      expect(mockEmbedMany).toHaveBeenCalledTimes(1);
      expect(mockEmbedMany).toHaveBeenCalledWith(
        expect.objectContaining({
          model: fakeModel,
          values: ['text1', 'text2', 'text3'],
        })
      );
    });

    it('should return null entries for individual failures without throwing', async () => {
      mockEmbedMany.mockRejectedValue(new Error('Batch embedding failed'));

      const result = await service.embedTexts(['text1', 'text2']);

      expect(result).toEqual([null, null]);
      expect(result).toHaveLength(2);
    });
  });
});
