'use client';

import { useEffect, useState, useCallback } from 'react';
import type { Room } from '@colyseus/sdk';
import {
  ClientMessage,
  ServerMessage,
  HOTBAR_SLOT_COUNT,
} from '@nookstead/shared';
import type {
  InventorySlotData,
  InventoryData,
  InventoryMovePayload,
  InventoryUpdatePayload,
} from '@nookstead/shared';
import { GameModal } from './GameModal';
import { ItemTooltip } from './ItemTooltip';
import type { HotbarItem } from './types';

const BACKPACK_SLOT_COUNT = 10;

interface InventoryPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room: Room | null;
  hotbarItems: (HotbarItem | null)[];
}

export function InventoryPanel({
  open,
  onOpenChange,
  room,
  hotbarItems,
}: InventoryPanelProps) {
  const [backpackSlots, setBackpackSlots] = useState<
    (InventorySlotData | null)[]
  >(Array(BACKPACK_SLOT_COUNT).fill(null));
  const [hoveredBackpackSlot, setHoveredBackpackSlot] = useState<number | null>(
    null
  );
  const [hoveredHotbarSlot, setHoveredHotbarSlot] = useState<number | null>(
    null
  );

  useEffect(() => {
    if (!room || !open) return;

    // Request backpack data on open
    room.send(ClientMessage.INVENTORY_REQUEST, {});

    // Listen for INVENTORY_DATA response
    const unsubData = room.onMessage(
      ServerMessage.INVENTORY_DATA,
      (data: InventoryData) => {
        const slots: (InventorySlotData | null)[] =
          Array(BACKPACK_SLOT_COUNT).fill(null);
        data.slots.forEach((slot) => {
          if (slot.slotIndex >= HOTBAR_SLOT_COUNT) {
            slots[slot.slotIndex - HOTBAR_SLOT_COUNT] = slot;
          }
        });
        setBackpackSlots(slots);
      }
    );

    // Listen for INVENTORY_UPDATE (after moves)
    const unsubUpdate = room.onMessage(
      ServerMessage.INVENTORY_UPDATE,
      (data: InventoryUpdatePayload) => {
        if (!data.success || !data.updatedSlots) return;
        const { updatedSlots } = data;
        setBackpackSlots((prev) => {
          const next = [...prev];
          updatedSlots.forEach((slot) => {
            if (slot.slotIndex >= HOTBAR_SLOT_COUNT) {
              next[slot.slotIndex - HOTBAR_SLOT_COUNT] = slot.itemType
                ? slot
                : null;
            }
          });
          return next;
        });
      }
    );

    // Listen for INVENTORY_ERROR
    const unsubError = room.onMessage(
      ServerMessage.INVENTORY_ERROR,
      () => {
        // Visual feedback could be added here in the future
      }
    );

    return () => {
      unsubData();
      unsubUpdate();
      unsubError();
    };
  }, [room, open]);

  const handleBackpackSlotClick = useCallback(
    (slotIndex: number) => {
      if (!room) return;
      const slot = backpackSlots[slotIndex];
      if (!slot || !slot.itemType) return;

      // Find first free hotbar slot
      const freeHotbar = hotbarItems.findIndex((h) => h === null);
      if (freeHotbar === -1) return;

      const payload: InventoryMovePayload = {
        fromSlot: slotIndex + HOTBAR_SLOT_COUNT,
        toSlot: freeHotbar,
      };
      room.send(ClientMessage.INVENTORY_MOVE, payload);
    },
    [room, hotbarItems, backpackSlots]
  );

  const handleHotbarSlotClick = useCallback(
    (slotIndex: number) => {
      if (!room) return;
      const item = hotbarItems[slotIndex];
      if (!item) return;

      // Find first free backpack slot
      const freeBackpack = backpackSlots.findIndex((s) => s === null);
      if (freeBackpack === -1) return;

      const payload: InventoryMovePayload = {
        fromSlot: slotIndex,
        toSlot: freeBackpack + HOTBAR_SLOT_COUNT,
      };
      room.send(ClientMessage.INVENTORY_MOVE, payload);
    },
    [room, hotbarItems, backpackSlots]
  );

  return (
    <GameModal
      open={open}
      onOpenChange={onOpenChange}
      title="Inventory"
      className="inventory-modal"
    >
      <div className="inventory-layout">
        {/* Backpack section */}
        <div className="inventory-backpack">
          {backpackSlots.map((slot, i) => (
            <div
              key={`b-${i}`}
              className="inventory-slot"
              onClick={() => handleBackpackSlotClick(i)}
              onMouseEnter={() => setHoveredBackpackSlot(i)}
              onMouseLeave={() => setHoveredBackpackSlot(null)}
              title={slot?.itemType ?? ''}
            >
              {slot?.itemType && (
                <span className="inventory-slot__qty">
                  {slot.quantity > 1 ? slot.quantity : ''}
                </span>
              )}
              {hoveredBackpackSlot === i && slot?.itemType && (
                <ItemTooltip itemType={slot.itemType} position="beside" />
              )}
            </div>
          ))}
        </div>

        <div className="inventory-divider" />

        {/* Hotbar section */}
        <div className="inventory-hotbar">
          {hotbarItems.map((item, i) => (
            <div
              key={`h-${i}`}
              className="inventory-slot"
              onClick={() => handleHotbarSlotClick(i)}
              onMouseEnter={() => setHoveredHotbarSlot(i)}
              onMouseLeave={() => setHoveredHotbarSlot(null)}
              title={item?.id ?? ''}
            >
              {item && (
                <span className="inventory-slot__qty">
                  {item.quantity > 1 ? item.quantity : ''}
                </span>
              )}
              {hoveredHotbarSlot === i && item && (
                <ItemTooltip itemType={item.id} position="above" />
              )}
            </div>
          ))}
        </div>
      </div>
    </GameModal>
  );
}
