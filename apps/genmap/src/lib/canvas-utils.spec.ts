import { type CanvasBackground } from './canvas-utils';

describe('CanvasBackground type', () => {
  it('should accept checkerboard type', () => {
    const bg: CanvasBackground = { type: 'checkerboard' };
    expect(bg.type).toBe('checkerboard');
  });

  it('should accept solid type with color', () => {
    const bg: CanvasBackground = { type: 'solid', color: '#ff0000' };
    expect(bg.type).toBe('solid');
    expect(bg.color).toBe('#ff0000');
  });
});
