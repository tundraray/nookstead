import { describe, it, expect } from '@jest/globals';
import { Schema, ArraySchema } from '@colyseus/schema';
import { ChunkPlayer } from './ChunkRoomState.js';
import { InventorySlotSchema } from './InventorySlotSchema.js';
import { HOTBAR_SLOT_COUNT } from '@nookstead/shared';

describe('ChunkPlayer', () => {
  it('should create an instance', () => {
    const player = new ChunkPlayer();

    expect(player).toBeInstanceOf(ChunkPlayer);
  });

  it('should be a Colyseus Schema instance', () => {
    const player = new ChunkPlayer();

    expect(player).toBeInstanceOf(Schema);
  });

  describe('existing fields', () => {
    it('should have id field', () => {
      const player = new ChunkPlayer();
      player.id = 'test-id';

      expect(player.id).toBe('test-id');
    });

    it('should have worldX field', () => {
      const player = new ChunkPlayer();
      player.worldX = 100;

      expect(player.worldX).toBe(100);
    });

    it('should have worldY field', () => {
      const player = new ChunkPlayer();
      player.worldY = 200;

      expect(player.worldY).toBe(200);
    });

    it('should have direction field', () => {
      const player = new ChunkPlayer();
      player.direction = 'down';

      expect(player.direction).toBe('down');
    });

    it('should have skin field', () => {
      const player = new ChunkPlayer();
      player.skin = 'char1';

      expect(player.skin).toBe('char1');
    });

    it('should have name field', () => {
      const player = new ChunkPlayer();
      player.name = 'TestPlayer';

      expect(player.name).toBe('TestPlayer');
    });
  });

  describe('hotbar', () => {
    it('should have a hotbar property', () => {
      const player = new ChunkPlayer();

      expect(player.hotbar).toBeDefined();
    });

    it('should have hotbar as an ArraySchema', () => {
      const player = new ChunkPlayer();

      expect(player.hotbar).toBeInstanceOf(ArraySchema);
    });

    it('should pre-populate hotbar with HOTBAR_SLOT_COUNT (10) slots', () => {
      const player = new ChunkPlayer();

      expect(player.hotbar.length).toBe(HOTBAR_SLOT_COUNT);
      expect(player.hotbar.length).toBe(10);
    });

    it('should have InventorySlotSchema instances in each hotbar slot', () => {
      const player = new ChunkPlayer();

      expect(player.hotbar[0]).toBeInstanceOf(InventorySlotSchema);
    });

    it('should have empty slots by default (itemType === "")', () => {
      const player = new ChunkPlayer();

      expect(player.hotbar[0].itemType).toBe('');
    });

    it('should have last slot at index 9', () => {
      const player = new ChunkPlayer();

      expect(player.hotbar[9]).toBeDefined();
      expect(player.hotbar[9]).toBeInstanceOf(InventorySlotSchema);
    });

    it('should have all 10 slots with default empty values', () => {
      const player = new ChunkPlayer();

      for (let i = 0; i < 10; i++) {
        expect(player.hotbar[i]).toBeInstanceOf(InventorySlotSchema);
        expect(player.hotbar[i].itemType).toBe('');
        expect(player.hotbar[i].quantity).toBe(0);
      }
    });
  });

  describe('schema field count', () => {
    it('should have exactly 7 top-level fields (6 existing + 1 hotbar)', () => {
      const player = new ChunkPlayer();

      // Colyseus v4 stores field metadata on the ChangeTree
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const metadata = (player as any)['~changes'].metadata;
      const fieldNames = Object.values(metadata).map(
        (entry: unknown) => (entry as { name: string }).name
      );

      expect(fieldNames).toHaveLength(7);
      expect([...fieldNames].sort()).toEqual(
        ['direction', 'hotbar', 'id', 'name', 'skin', 'worldX', 'worldY'].sort()
      );
    });
  });
});
