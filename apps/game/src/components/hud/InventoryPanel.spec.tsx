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
  const onClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the panel with role="dialog" and Backpack heading', () => {
    const room = createMockRoom();
    render(
      <InventoryPanel
        room={room as never}
        hotbarItems={makeHotbarItems()}
        onClose={onClose}
      />
    );
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Backpack')).toBeTruthy();
  });

  it('sends INVENTORY_REQUEST on mount', () => {
    const room = createMockRoom();
    render(
      <InventoryPanel
        room={room as never}
        hotbarItems={makeHotbarItems()}
        onClose={onClose}
      />
    );
    expect(room.send).toHaveBeenCalledWith('inventory_request', {});
  });

  it('renders 10 backpack slots (5x2 grid)', () => {
    const room = createMockRoom();
    const { container } = render(
      <InventoryPanel
        room={room as never}
        hotbarItems={makeHotbarItems()}
        onClose={onClose}
      />
    );
    const backpackGrid = container.querySelector(
      '.inventory-panel__backpack'
    );
    expect(backpackGrid).toBeTruthy();
    const slots = backpackGrid!.querySelectorAll('.inventory-slot');
    expect(slots.length).toBe(10);
  });

  it('renders 10 hotbar slots in the panel', () => {
    const room = createMockRoom();
    const { container } = render(
      <InventoryPanel
        room={room as never}
        hotbarItems={makeHotbarItems()}
        onClose={onClose}
      />
    );
    const hotbarGrid = container.querySelector(
      '.inventory-panel__hotbar'
    );
    expect(hotbarGrid).toBeTruthy();
    const slots = hotbarGrid!.querySelectorAll('.inventory-slot');
    expect(slots.length).toBe(10);
  });

  it('populates backpack slots from INVENTORY_DATA message', () => {
    const room = createMockRoom();
    const { container } = render(
      <InventoryPanel
        room={room as never}
        hotbarItems={makeHotbarItems()}
        onClose={onClose}
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

    const backpackGrid = container.querySelector(
      '.inventory-panel__backpack'
    )!;
    const slots = backpackGrid.querySelectorAll('.inventory-slot');
    // slot 0 (index 10) should have quantity 3
    const qtyEl = slots[0].querySelector('.inventory-slot__qty');
    expect(qtyEl).toBeTruthy();
    expect(qtyEl!.textContent).toBe('3');
  });

  it('sends INVENTORY_MOVE when clicking a backpack slot with item', () => {
    const room = createMockRoom();
    const hotbarItems = makeHotbarItems(); // all empty
    const { container } = render(
      <InventoryPanel
        room={room as never}
        hotbarItems={hotbarItems}
        onClose={onClose}
      />
    );

    // Populate backpack slot 0 (index 10)
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

    const backpackGrid = container.querySelector(
      '.inventory-panel__backpack'
    )!;
    const slots = backpackGrid.querySelectorAll('.inventory-slot');

    // Click backpack slot 0 -> should move to first free hotbar slot (0)
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
    const hotbarItems = makeHotbarItems([0]); // slot 0 has an item
    const { container } = render(
      <InventoryPanel
        room={room as never}
        hotbarItems={hotbarItems}
        onClose={onClose}
      />
    );

    // All backpack slots empty -> first free backpack slot is index 10
    const hotbarGrid = container.querySelector(
      '.inventory-panel__hotbar'
    )!;
    const slots = hotbarGrid.querySelectorAll('.inventory-slot');

    act(() => {
      slots[0].dispatchEvent(
        new MouseEvent('click', { bubbles: true })
      );
    });

    expect(room.send).toHaveBeenCalledWith('inventory_move', {
      fromSlot: 0,
      toSlot: 10,
    });
  });

  it('calls onClose when the close button is clicked', async () => {
    const user = userEvent.setup();
    const room = createMockRoom();
    render(
      <InventoryPanel
        room={room as never}
        hotbarItems={makeHotbarItems()}
        onClose={onClose}
      />
    );

    const closeBtn = screen.getByLabelText('Close inventory');
    await user.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('updates backpack slots on INVENTORY_UPDATE message', () => {
    const room = createMockRoom();
    const { container } = render(
      <InventoryPanel
        room={room as never}
        hotbarItems={makeHotbarItems()}
        onClose={onClose}
      />
    );

    // First populate a slot
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

    // Now receive an update that clears that slot
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

    const backpackGrid = container.querySelector(
      '.inventory-panel__backpack'
    )!;
    const slots = backpackGrid.querySelectorAll('.inventory-slot');
    // Slot 0 should be empty now
    const qtyEl = slots[0].querySelector('.inventory-slot__qty');
    expect(qtyEl).toBeNull();
  });

  it('cleans up message listeners on unmount', () => {
    const room = createMockRoom();
    const { unmount } = render(
      <InventoryPanel
        room={room as never}
        hotbarItems={makeHotbarItems()}
        onClose={onClose}
      />
    );

    // 3 listeners should be registered
    expect(room.onMessage).toHaveBeenCalledTimes(3);

    // Unmount should call unsubscribe functions
    unmount();

    // After unmount, handlers should be cleaned up
    expect(room._handlers['inventory_data']).toBeUndefined();
    expect(room._handlers['inventory_update']).toBeUndefined();
    expect(room._handlers['inventory_error']).toBeUndefined();
  });

  it('does not send INVENTORY_MOVE for empty backpack slot click', () => {
    const room = createMockRoom();
    const { container } = render(
      <InventoryPanel
        room={room as never}
        hotbarItems={makeHotbarItems()}
        onClose={onClose}
      />
    );

    const backpackGrid = container.querySelector(
      '.inventory-panel__backpack'
    )!;
    const slots = backpackGrid.querySelectorAll('.inventory-slot');

    // Click empty backpack slot
    act(() => {
      slots[0].dispatchEvent(
        new MouseEvent('click', { bubbles: true })
      );
    });

    // Should not send inventory_move (only inventory_request on mount)
    const moveCalls = room.send.mock.calls.filter(
      (c: unknown[]) => c[0] === 'inventory_move'
    );
    expect(moveCalls.length).toBe(0);
  });

  it('does not send INVENTORY_MOVE for empty hotbar slot click', () => {
    const room = createMockRoom();
    const hotbarItems = makeHotbarItems(); // all empty
    const { container } = render(
      <InventoryPanel
        room={room as never}
        hotbarItems={hotbarItems}
        onClose={onClose}
      />
    );

    const hotbarGrid = container.querySelector(
      '.inventory-panel__hotbar'
    )!;
    const slots = hotbarGrid.querySelectorAll('.inventory-slot');

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

  it('does not crash when room is null', () => {
    render(
      <InventoryPanel
        room={null}
        hotbarItems={makeHotbarItems()}
        onClose={onClose}
      />
    );
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});
