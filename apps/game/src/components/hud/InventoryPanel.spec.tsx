import React from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InventoryPanel } from './InventoryPanel';
import type { HotbarItem, SpriteRect } from './types';
import { HOTBAR_SLOT_COUNT } from '@nookstead/shared';
import type {
  InventoryData,
  InventoryUpdatePayload,
} from '@nookstead/shared';

// Mock the sprite module
jest.mock('./sprite', () => ({
  SHEET_PATH: '/assets/ui/hud_32.png',
  SHEET_W: 1952,
  SHEET_H: 1376,
  TILE_SIZE: 32,
  TILE_COLS: 61,
  tileRect: () => [0, 0, 32, 32],
  tileRectCentered: () => [0, 0, 32, 32],
  spriteCSSStyle: () => ({
    backgroundImage: 'none',
    width: '16px',
    height: '16px',
    imageRendering: 'pixelated' as const,
  }),
  spriteNativeStyle: () => ({
    backgroundImage: 'none',
    width: '16px',
    height: '16px',
    imageRendering: 'pixelated' as const,
  }),
  spriteStretchStyle: () => ({
    backgroundImage: 'none',
    width: '100%',
    height: '100%',
    imageRendering: 'pixelated' as const,
  }),
}));

// Mock sprites module
jest.mock('./sprites', () => ({
  SLOT_NORMAL: {
    cornerTL: [0, 0, 32, 32],
    edgeT: [32, 0, 32, 32],
    cornerTR: [64, 0, 32, 32],
    edgeL: [0, 32, 32, 32],
    center: [32, 32, 32, 32],
    edgeR: [64, 32, 32, 32],
    cornerBL: [0, 64, 32, 32],
    edgeB: [32, 64, 32, 32],
    cornerBR: [64, 64, 32, 32],
  },
  SLOT_SELECTED: {
    cornerTL: [0, 0, 32, 32],
    edgeT: [32, 0, 32, 32],
    cornerTR: [64, 0, 32, 32],
    edgeL: [0, 32, 32, 32],
    center: [32, 32, 32, 32],
    edgeR: [64, 32, 32, 32],
    cornerBL: [0, 64, 32, 32],
    edgeB: [32, 64, 32, 32],
    cornerBR: [64, 64, 32, 32],
  },
  PANEL_MODAL: {
    cornerTL: [0, 0, 32, 32],
    edgeT: [32, 0, 32, 32],
    cornerTR: [64, 0, 32, 32],
    edgeL: [0, 32, 32, 32],
    center: [32, 32, 32, 32],
    edgeR: [64, 32, 32, 32],
    cornerBL: [0, 64, 32, 32],
    edgeB: [32, 64, 32, 32],
    cornerBR: [64, 64, 32, 32],
  },
  SPRITES: {
    closeIcon: [0, 0, 16, 16],
    headerLeft: [0, 0, 32, 32],
    headerCenter: [0, 0, 32, 32],
    headerRight: [0, 0, 32, 32],
  },
}));

const SPRITE_RECT: SpriteRect = [0, 0, 16, 16];

/** Create a mock Colyseus room with send/onMessage stubs. */
function createMockRoom() {
  const messageHandlers: Record<string, (...args: unknown[]) => void> = {};
  return {
    send: jest.fn(),
    onMessage: jest.fn(
      (type: string, handler: (...args: unknown[]) => void) => {
        messageHandlers[type] = handler;
        return () => {
          delete messageHandlers[type];
        };
      }
    ),
    _handlers: messageHandlers,
  };
}

function makeHotbarItems(
  filled: number[] = []
): (HotbarItem | null)[] {
  return Array.from({ length: HOTBAR_SLOT_COUNT }, (_, i) =>
    filled.includes(i)
      ? { id: `item_${i}`, spriteRect: SPRITE_RECT, quantity: 1 }
      : null
  );
}

describe('InventoryPanel', () => {
  const onOpenChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the dialog with Inventory title', () => {
    const room = createMockRoom();
    render(
      <InventoryPanel
        open={true}
        onOpenChange={onOpenChange}
        room={room as never}
        hotbarItems={makeHotbarItems()}
      />
    );
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Inventory')).toBeTruthy();
  });

  it('sends INVENTORY_REQUEST when opened', () => {
    const room = createMockRoom();
    render(
      <InventoryPanel
        open={true}
        onOpenChange={onOpenChange}
        room={room as never}
        hotbarItems={makeHotbarItems()}
      />
    );
    expect(room.send).toHaveBeenCalledWith('inventory_request', {});
  });

  it('renders 20 slots across hotbar and backpack sections', () => {
    const room = createMockRoom();
    render(
      <InventoryPanel
        open={true}
        onOpenChange={onOpenChange}
        room={room as never}
        hotbarItems={makeHotbarItems()}
      />
    );
    const layout = document.querySelector('.inventory-layout');
    expect(layout).toBeTruthy();
    const slots = layout!.querySelectorAll('.inventory-slot');
    expect(slots.length).toBe(20);
  });

  it('populates backpack slots from INVENTORY_DATA message', () => {
    const room = createMockRoom();
    render(
      <InventoryPanel
        open={true}
        onOpenChange={onOpenChange}
        room={room as never}
        hotbarItems={makeHotbarItems()}
      />
    );

    const inventoryData: InventoryData = {
      inventoryId: 'inv-1',
      maxSlots: 20,
      slots: [
        {
          slotIndex: 10,
          itemType: 'hoe',
          quantity: 3,
          ownedByType: 'player',
          ownedById: 'p1',
        },
        {
          slotIndex: 14,
          itemType: 'seed_radish',
          quantity: 5,
          ownedByType: 'player',
          ownedById: 'p1',
        },
      ],
    };

    act(() => {
      room._handlers['inventory_data'](inventoryData);
    });

    const grid = document.querySelector('.inventory-layout')!;
    const slots = grid.querySelectorAll('.inventory-slot');
    // Backpack slots are first in DOM (index 0-9)
    const qtyEl = slots[0].querySelector('.inventory-slot__qty');
    expect(qtyEl).toBeTruthy();
    expect(qtyEl!.textContent).toBe('3');
  });

  it('sends INVENTORY_MOVE when clicking a backpack slot with item', () => {
    const room = createMockRoom();
    const hotbarItems = makeHotbarItems();
    render(
      <InventoryPanel
        open={true}
        onOpenChange={onOpenChange}
        room={room as never}
        hotbarItems={hotbarItems}
      />
    );

    const inventoryData: InventoryData = {
      inventoryId: 'inv-1',
      maxSlots: 20,
      slots: [
        {
          slotIndex: 10,
          itemType: 'hoe',
          quantity: 1,
          ownedByType: 'player',
          ownedById: 'p1',
        },
      ],
    };
    act(() => {
      room._handlers['inventory_data'](inventoryData);
    });

    const grid = document.querySelector('.inventory-layout')!;
    const slots = grid.querySelectorAll('.inventory-slot');

    // Click backpack slot 0 (DOM index 0)
    act(() => {
      slots[0].dispatchEvent(
        new MouseEvent('click', { bubbles: true })
      );
    });

    expect(room.send).toHaveBeenCalledWith('inventory_move', {
      fromSlot: 10,
      toSlot: 0,
    });
  });

  it('sends INVENTORY_MOVE when clicking a hotbar slot with item', () => {
    const room = createMockRoom();
    const hotbarItems = makeHotbarItems([0]);
    render(
      <InventoryPanel
        open={true}
        onOpenChange={onOpenChange}
        room={room as never}
        hotbarItems={hotbarItems}
      />
    );

    const grid = document.querySelector('.inventory-layout')!;
    const slots = grid.querySelectorAll('.inventory-slot');

    // Hotbar slot 0 is DOM index 10
    act(() => {
      slots[10].dispatchEvent(
        new MouseEvent('click', { bubbles: true })
      );
    });

    expect(room.send).toHaveBeenCalledWith('inventory_move', {
      fromSlot: 0,
      toSlot: 10,
    });
  });

  it('calls onOpenChange when close button is clicked', async () => {
    const user = userEvent.setup();
    const room = createMockRoom();
    render(
      <InventoryPanel
        open={true}
        onOpenChange={onOpenChange}
        room={room as never}
        hotbarItems={makeHotbarItems()}
      />
    );

    const closeBtn = screen.getByLabelText('Close');
    await user.click(closeBtn);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('updates backpack slots on INVENTORY_UPDATE message', () => {
    const room = createMockRoom();
    render(
      <InventoryPanel
        open={true}
        onOpenChange={onOpenChange}
        room={room as never}
        hotbarItems={makeHotbarItems()}
      />
    );

    act(() => {
      room._handlers['inventory_data']({
        inventoryId: 'inv-1',
        maxSlots: 20,
        slots: [
          {
            slotIndex: 10,
            itemType: 'hoe',
            quantity: 2,
            ownedByType: 'player',
            ownedById: 'p1',
          },
        ],
      } as InventoryData);
    });

    const update: InventoryUpdatePayload = {
      success: true,
      updatedSlots: [
        {
          slotIndex: 10,
          itemType: null,
          quantity: 0,
          ownedByType: null,
          ownedById: null,
        },
      ],
    };
    act(() => {
      room._handlers['inventory_update'](update);
    });

    const grid = document.querySelector('.inventory-layout')!;
    const slots = grid.querySelectorAll('.inventory-slot');
    // Backpack slot 0 is DOM index 0
    const qtyEl = slots[0].querySelector('.inventory-slot__qty');
    expect(qtyEl).toBeNull();
  });

  it('cleans up message listeners on unmount', () => {
    const room = createMockRoom();
    const { unmount } = render(
      <InventoryPanel
        open={true}
        onOpenChange={onOpenChange}
        room={room as never}
        hotbarItems={makeHotbarItems()}
      />
    );

    expect(room.onMessage).toHaveBeenCalledTimes(3);

    unmount();

    expect(room._handlers['inventory_data']).toBeUndefined();
    expect(room._handlers['inventory_update']).toBeUndefined();
    expect(room._handlers['inventory_error']).toBeUndefined();
  });

  it('does not send INVENTORY_MOVE for empty backpack slot click', () => {
    const room = createMockRoom();
    render(
      <InventoryPanel
        open={true}
        onOpenChange={onOpenChange}
        room={room as never}
        hotbarItems={makeHotbarItems()}
      />
    );

    const grid = document.querySelector('.inventory-layout')!;
    const slots = grid.querySelectorAll('.inventory-slot');

    // Click empty backpack slot (DOM index 0)
    act(() => {
      slots[0].dispatchEvent(
        new MouseEvent('click', { bubbles: true })
      );
    });

    const moveCalls = room.send.mock.calls.filter(
      (c: unknown[]) => c[0] === 'inventory_move'
    );
    expect(moveCalls.length).toBe(0);
  });

  it('does not send INVENTORY_MOVE for empty hotbar slot click', () => {
    const room = createMockRoom();
    const hotbarItems = makeHotbarItems();
    render(
      <InventoryPanel
        open={true}
        onOpenChange={onOpenChange}
        room={room as never}
        hotbarItems={hotbarItems}
      />
    );

    const grid = document.querySelector('.inventory-layout')!;
    const slots = grid.querySelectorAll('.inventory-slot');

    // Click empty hotbar slot (DOM index 10)
    act(() => {
      slots[10].dispatchEvent(
        new MouseEvent('click', { bubbles: true })
      );
    });

    const moveCalls = room.send.mock.calls.filter(
      (c: unknown[]) => c[0] === 'inventory_move'
    );
    expect(moveCalls.length).toBe(0);
  });

  it('does not crash when room is null', () => {
    render(
      <InventoryPanel
        open={true}
        onOpenChange={onOpenChange}
        room={null}
        hotbarItems={makeHotbarItems()}
      />
    );
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});
