import {
  DEFAULT_PLAYER_INVENTORY_SIZE,
  HOTBAR_SLOT_COUNT,
  DEFAULT_NPC_INVENTORY_SIZE,
  MAX_INVENTORY_SIZE,
} from '../constants';

describe('Inventory configuration constants', () => {
  it('DEFAULT_PLAYER_INVENTORY_SIZE equals 20', () => {
    expect(DEFAULT_PLAYER_INVENTORY_SIZE).toBe(20);
  });

  it('HOTBAR_SLOT_COUNT equals 10', () => {
    expect(HOTBAR_SLOT_COUNT).toBe(10);
  });

  it('DEFAULT_NPC_INVENTORY_SIZE equals 10', () => {
    expect(DEFAULT_NPC_INVENTORY_SIZE).toBe(10);
  });

  it('MAX_INVENTORY_SIZE equals 40', () => {
    expect(MAX_INVENTORY_SIZE).toBe(40);
  });

  it('player inventory can hold at least the hotbar', () => {
    expect(DEFAULT_PLAYER_INVENTORY_SIZE).toBeGreaterThanOrEqual(
      HOTBAR_SLOT_COUNT
    );
  });

  it('max inventory size is at least the default player size', () => {
    expect(MAX_INVENTORY_SIZE).toBeGreaterThanOrEqual(
      DEFAULT_PLAYER_INVENTORY_SIZE
    );
  });
});
