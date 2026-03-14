import {
  generateFenceTileset,
  FrameImageSource,
} from './fence-tileset';

// ---------------------------------------------------------------------------
// Canvas mock for Node.js test environment (no DOM available)
// ---------------------------------------------------------------------------

function createMockCanvas() {
  const mockCtx = {
    drawImage: jest.fn(),
  };
  const mockCanvas = {
    width: 0,
    height: 0,
    getContext: jest.fn(() => mockCtx),
  };
  return { mockCanvas, mockCtx };
}

function createMockFactory() {
  const { mockCanvas, mockCtx } = createMockCanvas();
  const factory = () => mockCanvas as unknown as HTMLCanvasElement;
  return { factory, mockCanvas, mockCtx };
}

/** Create a minimal FrameImageSource with a non-null image stub. */
function makeFrame(
  frameIndex: number,
  srcX = 0,
  srcY = 0,
  srcW = 16,
  srcH = 16,
): FrameImageSource {
  return {
    frameIndex,
    image: {} as CanvasImageSource, // non-null stub
    srcX,
    srcY,
    srcW,
    srcH,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('generateFenceTileset', () => {
  // --- Canvas dimensions ---

  test('returns canvas with width 64px (4 columns x 16px)', () => {
    const { factory, mockCanvas } = createMockFactory();
    generateFenceTileset([], factory);
    expect(mockCanvas.width).toBe(64);
  });

  test('returns canvas with height 80px (5 rows x 16px)', () => {
    const { factory, mockCanvas } = createMockFactory();
    generateFenceTileset([], factory);
    expect(mockCanvas.height).toBe(80);
  });

  // --- Frame placement: connection frames ---

  test('frame 1 (bitmask 0): drawn at destX=0, destY=0', () => {
    const { factory, mockCtx } = createMockFactory();
    const frame = makeFrame(1, 10, 20, 16, 16);
    generateFenceTileset([frame], factory);

    expect(mockCtx.drawImage).toHaveBeenCalledWith(
      frame.image,
      10, 20, 16, 16, // src rect
      0, 0, 16, 16,   // dest rect
    );
  });

  test('frame 5 (bitmask 4): drawn at destX=0, destY=16', () => {
    const { factory, mockCtx } = createMockFactory();
    // frameIndex 5, idx = 4, col = 4 % 4 = 0, row = floor(4/4) = 1
    const frame = makeFrame(5, 0, 0, 16, 16);
    generateFenceTileset([frame], factory);

    expect(mockCtx.drawImage).toHaveBeenCalledWith(
      frame.image,
      0, 0, 16, 16,
      0, 16, 16, 16,   // destX=0, destY=16
    );
  });

  test('frame 16 (bitmask 15): drawn at destX=48, destY=48', () => {
    const { factory, mockCtx } = createMockFactory();
    // frameIndex 16, idx = 15, col = 15 % 4 = 3, row = floor(15/4) = 3
    const frame = makeFrame(16, 5, 5, 16, 16);
    generateFenceTileset([frame], factory);

    expect(mockCtx.drawImage).toHaveBeenCalledWith(
      frame.image,
      5, 5, 16, 16,
      48, 48, 16, 16,  // destX=48, destY=48
    );
  });

  // --- Frame placement: gate frames ---

  test('frame 17 (gate vertical closed): drawn at destX=0, destY=64', () => {
    const { factory, mockCtx } = createMockFactory();
    // frameIndex 17, idx = 16, col = 16 % 4 = 0, row = floor(16/4) = 4
    const frame = makeFrame(17, 0, 0, 16, 16);
    generateFenceTileset([frame], factory);

    expect(mockCtx.drawImage).toHaveBeenCalledWith(
      frame.image,
      0, 0, 16, 16,
      0, 64, 16, 16,
    );
  });

  test('frame 18 (gate vertical open): drawn at destX=16, destY=64', () => {
    const { factory, mockCtx } = createMockFactory();
    const frame = makeFrame(18, 0, 0, 16, 16);
    generateFenceTileset([frame], factory);

    expect(mockCtx.drawImage).toHaveBeenCalledWith(
      frame.image,
      0, 0, 16, 16,
      16, 64, 16, 16,
    );
  });

  test('frame 19 (gate horizontal closed): drawn at destX=32, destY=64', () => {
    const { factory, mockCtx } = createMockFactory();
    const frame = makeFrame(19, 0, 0, 16, 16);
    generateFenceTileset([frame], factory);

    expect(mockCtx.drawImage).toHaveBeenCalledWith(
      frame.image,
      0, 0, 16, 16,
      32, 64, 16, 16,
    );
  });

  test('frame 20 (gate horizontal open): drawn at destX=48, destY=64', () => {
    const { factory, mockCtx } = createMockFactory();
    const frame = makeFrame(20, 0, 0, 16, 16);
    generateFenceTileset([frame], factory);

    expect(mockCtx.drawImage).toHaveBeenCalledWith(
      frame.image,
      0, 0, 16, 16,
      48, 64, 16, 16,
    );
  });

  // --- Null image handling ---

  test('null image: no drawImage call for that frame', () => {
    const { factory, mockCtx } = createMockFactory();
    const frame: FrameImageSource = {
      frameIndex: 3,
      image: null,
      srcX: 0,
      srcY: 0,
      srcW: 16,
      srcH: 16,
    };
    generateFenceTileset([frame], factory);

    expect(mockCtx.drawImage).not.toHaveBeenCalled();
  });

  test('partial missing frames: tiles with images drawn, missing tiles skipped', () => {
    const { factory, mockCtx } = createMockFactory();
    const validFrame = makeFrame(2, 0, 0, 16, 16);
    const nullFrame: FrameImageSource = {
      frameIndex: 5,
      image: null,
      srcX: 0,
      srcY: 0,
      srcW: 16,
      srcH: 16,
    };
    generateFenceTileset([validFrame, nullFrame], factory);

    expect(mockCtx.drawImage).toHaveBeenCalledTimes(1);
    // Only the valid frame (index 2) should be drawn
    expect(mockCtx.drawImage).toHaveBeenCalledWith(
      validFrame.image,
      0, 0, 16, 16,
      16, 0, 16, 16, // idx=1, col=1, row=0
    );
  });

  // --- Frame 0 (empty sentinel) ---

  test('frame index 0 (empty sentinel): no drawImage call', () => {
    const { factory, mockCtx } = createMockFactory();
    const frame = makeFrame(0, 0, 0, 16, 16);
    generateFenceTileset([frame], factory);

    expect(mockCtx.drawImage).not.toHaveBeenCalled();
  });

  // --- Canvas factory ---

  test('uses custom canvas factory function', () => {
    const { mockCanvas } = createMockCanvas();
    const customFactory = jest.fn(
      () => mockCanvas as unknown as HTMLCanvasElement,
    );

    const result = generateFenceTileset([], customFactory);

    expect(customFactory).toHaveBeenCalledTimes(1);
    expect(result).toBe(mockCanvas);
  });

  test('returns the canvas created by the factory', () => {
    const { factory, mockCanvas } = createMockFactory();
    const result = generateFenceTileset([], factory);
    expect(result).toBe(mockCanvas);
  });
});
