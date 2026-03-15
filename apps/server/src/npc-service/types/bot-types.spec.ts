import { describe, it, expect } from '@jest/globals';
import type { NpcBot } from '@nookstead/db';
import { createServerBot } from './bot-types.js';
import type { ServerBot } from './bot-types.js';

/**
 * Create a minimal NpcBot record for testing.
 */
function makeBotRecord(overrides?: Partial<NpcBot>): NpcBot {
  return {
    id: overrides?.id ?? 'bot-1',
    mapId: overrides?.mapId ?? 'test-map-id',
    name: overrides?.name ?? 'Biscuit',
    skin: overrides?.skin ?? 'scout_1',
    worldX: overrides?.worldX ?? 80,
    worldY: overrides?.worldY ?? 80,
    direction: overrides?.direction ?? 'down',
    personality: overrides?.personality ?? null,
    role: overrides?.role ?? null,
    speechStyle: overrides?.speechStyle ?? null,
    bio: overrides?.bio ?? null,
    age: overrides?.age ?? null,
    traits: overrides?.traits ?? null,
    goals: overrides?.goals ?? null,
    fears: overrides?.fears ?? null,
    interests: overrides?.interests ?? null,
    createdAt: overrides?.createdAt ?? new Date('2026-01-01'),
    updatedAt: overrides?.updatedAt ?? new Date('2026-01-01'),
  };
}

describe('bot-types', () => {
  describe('createServerBot inventoryId', () => {
    it('should initialize inventoryId to null', () => {
      const record = makeBotRecord();
      const bot = createServerBot(record);

      expect(bot.inventoryId).toBeNull();
    });

    it('should allow inventoryId to be set to a UUID string', () => {
      const record = makeBotRecord();
      const bot = createServerBot(record);

      // ServerBot is mutable; inventoryId can be set to a UUID later
      bot.inventoryId = 'inv-abc-123';
      expect(bot.inventoryId).toBe('inv-abc-123');
    });

    it('should accept inventoryId as null in ServerBot type', () => {
      const bot: ServerBot = {
        ...createServerBot(makeBotRecord()),
        inventoryId: null,
      };

      expect(bot.inventoryId).toBeNull();
    });

    it('should accept inventoryId as string in ServerBot type', () => {
      const bot: ServerBot = {
        ...createServerBot(makeBotRecord()),
        inventoryId: 'some-uuid',
      };

      expect(bot.inventoryId).toBe('some-uuid');
    });
  });
});
