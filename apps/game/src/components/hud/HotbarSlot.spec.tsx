import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HotbarSlot } from './HotbarSlot';
import type { HotbarItem, SpriteRect } from './types';

// Mock the sprite module to avoid needing the actual sprite sheet
const mockStyle = () => ({
  backgroundImage: 'none',
  width: '16px',
  height: '16px',
  imageRendering: 'pixelated' as const,
});
jest.mock('./sprite', () => ({
  SHEET_PATH: '/assets/ui/hud_32.png',
  SHEET_W: 1952,
  SHEET_H: 1376,
  TILE_SIZE: 32,
  TILE_COLS: 61,
  tileRect: (pos: number, w = 32, h = w) => {
    const index = pos - 1;
    const col = index % 61;
    const row = Math.floor(index / 61);
    return [col * 32, row * 32, w, h];
  },
  tileRectCentered: (pos: number, size: number) => {
    const index = pos - 1;
    const col = index % 61;
    const row = Math.floor(index / 61);
    const offset = Math.floor((32 - size) / 2);
    return [col * 32 + offset, row * 32 + offset, size, size];
  },
  spriteCSSStyle: () => mockStyle(),
  spriteNativeStyle: () => mockStyle(),
  spriteStretchStyle: () => mockStyle(),
}));

const SPRITE_RECT: SpriteRect = [0, 0, 16, 16];

describe('HotbarSlot', () => {
  const defaultProps = {
    item: null as HotbarItem | null,
    index: 0,
    isSelected: false,
    onClick: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders slot with key hint', () => {
    render(<HotbarSlot {...defaultProps} />);
    expect(screen.getByText('1')).toBeTruthy();
  });

  it('renders empty slot without tooltip trigger', async () => {
    const user = userEvent.setup();
    const { container } = render(<HotbarSlot {...defaultProps} />);
    const button = screen.getByRole('button');
    await user.hover(button);
    expect(container.querySelector('.item-tooltip')).toBeNull();
  });

  it('shows tooltip on hover when slot has an item', async () => {
    const user = userEvent.setup();
    const item: HotbarItem = {
      id: 'hoe',
      spriteRect: SPRITE_RECT,
      quantity: 1,
    };
    render(<HotbarSlot {...defaultProps} item={item} />);
    const button = screen.getByRole('button');
    await user.hover(button);
    expect(screen.getByRole('tooltip')).toBeTruthy();
    expect(screen.getByText('Hoe')).toBeTruthy();
  });

  it('hides tooltip when cursor leaves the slot', async () => {
    const user = userEvent.setup();
    const item: HotbarItem = {
      id: 'hoe',
      spriteRect: SPRITE_RECT,
      quantity: 1,
    };
    const { container } = render(
      <HotbarSlot {...defaultProps} item={item} />
    );
    const button = screen.getByRole('button');
    await user.hover(button);
    expect(screen.getByRole('tooltip')).toBeTruthy();
    await user.unhover(button);
    expect(container.querySelector('.item-tooltip')).toBeNull();
  });

  it('does not show tooltip for empty slot on hover', async () => {
    const user = userEvent.setup();
    const { container } = render(<HotbarSlot {...defaultProps} />);
    const button = screen.getByRole('button');
    await user.hover(button);
    expect(container.querySelector('.item-tooltip')).toBeNull();
  });

  it('positions tooltip above the slot', async () => {
    const user = userEvent.setup();
    const item: HotbarItem = {
      id: 'hoe',
      spriteRect: SPRITE_RECT,
      quantity: 1,
    };
    render(<HotbarSlot {...defaultProps} item={item} />);
    const button = screen.getByRole('button');
    await user.hover(button);
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip.classList.contains('item-tooltip--above')).toBe(true);
  });
});
