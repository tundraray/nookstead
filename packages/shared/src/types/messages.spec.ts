import { ClientMessage, ServerMessage } from './messages';

describe('ClientMessage', () => {
  // Spot-check existing entries are unchanged
  it('should retain existing MOVE entry', () => {
    expect(ClientMessage.MOVE).toBe('move');
  });

  it('should retain existing NPC_INTERACT entry', () => {
    expect(ClientMessage.NPC_INTERACT).toBe('npc_interact');
  });

  it('should retain existing DIALOGUE_MESSAGE entry', () => {
    expect(ClientMessage.DIALOGUE_MESSAGE).toBe('dialogue_message');
  });

  // Inventory entries
  it('should define INVENTORY_REQUEST', () => {
    expect(ClientMessage.INVENTORY_REQUEST).toBe('inventory_request');
  });

  it('should define INVENTORY_MOVE', () => {
    expect(ClientMessage.INVENTORY_MOVE).toBe('inventory_move');
  });

  it('should define INVENTORY_ADD', () => {
    expect(ClientMessage.INVENTORY_ADD).toBe('inventory_add');
  });

  it('should define INVENTORY_DROP', () => {
    expect(ClientMessage.INVENTORY_DROP).toBe('inventory_drop');
  });
});

describe('ServerMessage', () => {
  // Spot-check existing entries are unchanged
  it('should retain existing ERROR entry', () => {
    expect(ServerMessage.ERROR).toBe('error');
  });

  it('should retain existing MAP_DATA entry', () => {
    expect(ServerMessage.MAP_DATA).toBe('map_data');
  });

  it('should retain existing CLOCK_CONFIG entry', () => {
    expect(ServerMessage.CLOCK_CONFIG).toBe('clock_config');
  });

  // Inventory entries
  it('should define INVENTORY_DATA', () => {
    expect(ServerMessage.INVENTORY_DATA).toBe('inventory_data');
  });

  it('should define INVENTORY_UPDATE', () => {
    expect(ServerMessage.INVENTORY_UPDATE).toBe('inventory_update');
  });

  it('should define INVENTORY_ERROR', () => {
    expect(ServerMessage.INVENTORY_ERROR).toBe('inventory_error');
  });
});
