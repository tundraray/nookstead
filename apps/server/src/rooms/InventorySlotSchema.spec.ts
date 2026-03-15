import { describe, it, expect } from '@jest/globals';
import { Schema } from '@colyseus/schema';
import { InventorySlotSchema } from './InventorySlotSchema.js';

describe('InventorySlotSchema', () => {
  it('should create an instance', () => {
    const slot = new InventorySlotSchema();

    expect(slot).toBeInstanceOf(InventorySlotSchema);
  });

  it('should be a Colyseus Schema instance', () => {
    const slot = new InventorySlotSchema();

    expect(slot).toBeInstanceOf(Schema);
  });

  it('should default itemType to empty string (empty slot sentinel)', () => {
    const slot = new InventorySlotSchema();

    expect(slot.itemType).toBe('');
  });

  it('should default quantity to 0', () => {
    const slot = new InventorySlotSchema();

    expect(slot.quantity).toBe(0);
  });

  it('should default spriteX to 0', () => {
    const slot = new InventorySlotSchema();

    expect(slot.spriteX).toBe(0);
  });

  it('should default spriteY to 0', () => {
    const slot = new InventorySlotSchema();

    expect(slot.spriteY).toBe(0);
  });

  it('should default spriteW to 16', () => {
    const slot = new InventorySlotSchema();

    expect(slot.spriteW).toBe(16);
  });

  it('should default spriteH to 16', () => {
    const slot = new InventorySlotSchema();

    expect(slot.spriteH).toBe(16);
  });

  it('should have exactly 6 schema fields', () => {
    const expectedFields = [
      'itemType',
      'quantity',
      'spriteX',
      'spriteY',
      'spriteW',
      'spriteH',
    ];
    const slot = new InventorySlotSchema();

    // Colyseus v4 stores field metadata on the ChangeTree
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const metadata = (slot as any)['~changes'].metadata;
    const fieldNames = Object.values(metadata).map(
      (entry: unknown) => (entry as { name: string }).name
    );

    expect(fieldNames).toHaveLength(6);
    expect([...fieldNames].sort()).toEqual(expectedFields.sort());
  });

  it('should allow setting all fields', () => {
    const slot = new InventorySlotSchema();

    slot.itemType = 'hoe';
    slot.quantity = 1;
    slot.spriteX = 32;
    slot.spriteY = 48;
    slot.spriteW = 16;
    slot.spriteH = 16;

    expect(slot.itemType).toBe('hoe');
    expect(slot.quantity).toBe(1);
    expect(slot.spriteX).toBe(32);
    expect(slot.spriteY).toBe(48);
    expect(slot.spriteW).toBe(16);
    expect(slot.spriteH).toBe(16);
  });

  it('should represent an empty slot when using default values', () => {
    const slot = new InventorySlotSchema();

    // Empty slot is identified by itemType === '' (not null)
    expect(slot.itemType).toBe('');
    expect(slot.quantity).toBe(0);
  });
});
