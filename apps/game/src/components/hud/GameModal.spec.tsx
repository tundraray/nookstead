import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GameModal } from './GameModal';
import { SLOT_SELECTED } from './sprites';

describe('GameModal', () => {
  const defaultProps = {
    open: true,
    onOpenChange: jest.fn(),
    children: <p>Modal content</p>,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // FR-1: Controlled Open/Close
  it('renders content when open is true', () => {
    render(<GameModal {...defaultProps} />);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Modal content')).toBeTruthy();
  });

  it('renders nothing when open is false', () => {
    render(<GameModal {...defaultProps} open={false} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  // FR-2: Accessibility (Radix Dialog)
  it('calls onOpenChange when Escape is pressed', async () => {
    const onOpenChange = jest.fn();
    render(<GameModal {...defaultProps} onOpenChange={onOpenChange} />);
    await userEvent.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('has role="dialog" attribute', () => {
    render(<GameModal {...defaultProps} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeTruthy();
  });

  it('renders title with aria-labelledby when title is provided', () => {
    render(<GameModal {...defaultProps} title="Test Title" />);
    expect(screen.getByText('Test Title')).toBeTruthy();
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-labelledby')).toBeTruthy();
  });

  it('renders description with aria-describedby when description is provided', () => {
    render(
      <GameModal {...defaultProps} description="Test Description" />
    );
    expect(screen.getByText('Test Description')).toBeTruthy();
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-describedby')).toBeTruthy();
  });

  // FR-3: NineSlicePanel Integration
  it('renders NineSlicePanel with game-modal-panel class', () => {
    render(<GameModal {...defaultProps} />);
    const panel = document.querySelector('.game-modal-panel');
    expect(panel).toBeTruthy();
  });

  it('accepts custom slices prop', () => {
    render(<GameModal {...defaultProps} slices={SLOT_SELECTED} />);
    const panel = document.querySelector('.game-modal-panel');
    expect(panel).toBeTruthy();
  });

  // FR-5: Portal
  it('renders in a portal (dialog is child of document.body)', () => {
    render(<GameModal {...defaultProps} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog.closest('body')).toBe(document.body);
  });

  // FR-6: Content Composition
  it('renders arbitrary children', () => {
    render(
      <GameModal {...defaultProps}>
        <button>Action</button>
      </GameModal>
    );
    expect(screen.getByText('Action')).toBeTruthy();
  });

  it('applies custom className to content wrapper', () => {
    render(<GameModal {...defaultProps} className="my-modal" />);
    const content = document.querySelector('.game-modal-content');
    expect(content?.classList.contains('my-modal')).toBe(true);
  });

  it('renders an accessible close button', () => {
    render(<GameModal {...defaultProps} />);
    const closeBtn = screen.getByLabelText('Close');
    expect(closeBtn).toBeTruthy();
  });
});
