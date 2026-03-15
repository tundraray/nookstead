/**
 * Owner type discriminator for inventories and slots.
 * Used to route DB queries to the correct owner entity.
 */
export type OwnerType = 'player' | 'npc';

/**
 * Serialized inventory slot state.
 * Used in INVENTORY_DATA and INVENTORY_UPDATE messages.
 * Note: itemType is null (not '') for empty slots at this layer.
 * The Colyseus InventorySlotSchema maps null to '' for schema compatibility.
 */
export interface InventorySlotData {
  /** Slot index (0-based). Slots 0-9 = hotbar, 10+ = backpack. */
  slotIndex: number;
  /** Item type identifier (key into ITEM_DEFINITIONS). Null if slot is empty. */
  itemType: string | null;
  /** Quantity of items in this slot. 0 if empty. */
  quantity: number;
  /** Who owns this item (may differ from inventory holder). Null if empty. */
  ownedByType: OwnerType | null;
  /** UUID of the owner entity. Null if empty or using default ownership. */
  ownedById: string | null;
}

/**
 * Full inventory state sent via INVENTORY_DATA message.
 * Client-side representation of a loaded inventory.
 */
export interface InventoryData {
  /** Inventory UUID. */
  inventoryId: string;
  /** Maximum number of slots in this inventory. */
  maxSlots: number;
  /** Slot contents (may omit empty slots for backpack responses). */
  slots: InventorySlotData[];
}

/**
 * Payload for ClientMessage.INVENTORY_MOVE.
 */
export interface InventoryMovePayload {
  /** Source slot index (0-based). */
  fromSlot: number;
  /** Destination slot index (0-based). */
  toSlot: number;
  /** Quantity to move. If omitted, moves the entire stack. */
  quantity?: number;
}

/**
 * Payload for ClientMessage.INVENTORY_ADD (debug/admin use only).
 * In production, items are added through game mechanics.
 */
export interface InventoryAddPayload {
  /** Item type string (must be a key in ITEM_DEFINITIONS). */
  itemType: string;
  /** Quantity to add. Defaults to 1 if omitted. */
  quantity?: number;
  /** Target slot index. If omitted, finds first available slot. */
  slotIndex?: number;
}

/**
 * Payload for ClientMessage.INVENTORY_DROP.
 */
export interface InventoryDropPayload {
  /** Slot index to drop from (0-based). */
  slotIndex: number;
  /** Quantity to drop. If omitted, drops the entire stack. */
  quantity?: number;
}

/**
 * Server response payload for ServerMessage.INVENTORY_UPDATE.
 * Sent after INVENTORY_MOVE, INVENTORY_ADD, and INVENTORY_DROP operations.
 */
export interface InventoryUpdatePayload {
  /** Whether the operation succeeded. */
  success: boolean;
  /** Human-readable error description if success is false. */
  error?: string;
  /** Only the slots that changed (partial update). */
  updatedSlots?: InventorySlotData[];
}
