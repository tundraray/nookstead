import React from 'react';
import { render, screen } from '@testing-library/react';
import { ItemTooltip } from './ItemTooltip';

describe('ItemTooltip', () => {
  // FR-1: Renders nothing when itemType is null
  it('renders nothing when itemType is null', () => {
    const { container } = render(<ItemTooltip itemType={null} />);
    expect(container.innerHTML).toBe('');
  });

  // FR-2: Renders nothing when itemType is empty string
  it('renders nothing when itemType is empty string', () => {
    const { container } = render(<ItemTooltip itemType={''} />);
    expect(container.innerHTML).toBe('');
  });

  // FR-3: Shows display name, category, and description for a known item
  it('renders displayName, category, and description for a known item', () => {
    render(<ItemTooltip itemType="hoe" />);
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toBeTruthy();
    expect(screen.getByText('Hoe')).toBeTruthy();
    expect(screen.getByText('tool')).toBeTruthy();
    expect(screen.getByText('Till the soil for planting.')).toBeTruthy();
  });

  // FR-4: Omits description when item has no description
  it('does not render description element when item has no description', () => {
    render(<ItemTooltip itemType="seed_radish" />);
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toBeTruthy();
    expect(screen.getByText('Radish Seeds')).toBeTruthy();
    expect(screen.getByText('seed')).toBeTruthy();
    // seed_radish has no description field
    expect(
      tooltip.querySelector('.item-tooltip__description')
    ).toBeNull();
  });

  // FR-5: Fallback rendering for unknown itemType
  it('renders fallback with raw itemType string for unknown item', () => {
    render(<ItemTooltip itemType="mystery_widget" />);
    expect(screen.getByText('mystery_widget')).toBeTruthy();
    // Should not have role="tooltip" for fallback (no full definition)
    const tooltipDiv = screen
      .getByText('mystery_widget')
      .closest('.item-tooltip');
    expect(tooltipDiv).toBeTruthy();
  });

  // FR-6: Applies 'above' position class by default
  it('applies item-tooltip--above class by default', () => {
    render(<ItemTooltip itemType="hoe" />);
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip.classList.contains('item-tooltip--above')).toBe(true);
  });

  // FR-7: Applies 'beside' position class when specified
  it('applies item-tooltip--beside class when position is beside', () => {
    render(<ItemTooltip itemType="hoe" position="beside" />);
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip.classList.contains('item-tooltip--beside')).toBe(true);
  });

  // FR-8: Category text gets color styling
  it('applies color style to category text for known categories', () => {
    render(<ItemTooltip itemType="hoe" />);
    const categoryEl = screen.getByText('tool');
    expect(categoryEl.style.color).toBe('rgb(139, 115, 85)'); // #8B7355
  });
});
