declare module 'gifenc' {
  type RGBColor = [number, number, number];
  type RGBAColor = [number, number, number, number];
  type Color = RGBColor | RGBAColor;

  interface GIFEncoderOptions {
    initialCapacity?: number;
    auto?: boolean;
  }

  interface WriteFrameOptions {
    transparent?: boolean;
    transparentIndex?: number;
    delay?: number;
    palette?: Color[] | null;
    repeat?: number;
    colorDepth?: number;
    dispose?: number;
    first?: boolean;
  }

  interface GIFEncoderInstance {
    reset(): void;
    finish(): void;
    bytes(): Uint8Array;
    bytesView(): Uint8Array;
    readonly buffer: ArrayBuffer;
    writeHeader(): void;
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      opts?: WriteFrameOptions
    ): void;
  }

  type QuantizeFormat =
    | 'rgb565'
    | 'rgba4444'
    | 'rgb444';

  interface QuantizeOptions {
    format?: QuantizeFormat;
    oneBitAlpha?: boolean | number;
    clearAlpha?: boolean;
    clearAlphaColor?: number;
    clearAlphaThreshold?: number;
  }

  export function GIFEncoder(opts?: GIFEncoderOptions): GIFEncoderInstance;

  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    options?: QuantizeOptions
  ): Color[];

  export function prequantize(
    rgba: Uint8Array | Uint8ClampedArray,
    options?: {
      roundRGB?: number;
      roundAlpha?: number;
      oneBitAlpha?: boolean | number;
    }
  ): void;

  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: Color[],
    format?: QuantizeFormat
  ): Uint8Array;

  export function nearestColorIndex(
    palette: Color[],
    color: Color,
    format?: QuantizeFormat
  ): number;

  export function nearestColor(
    palette: Color[],
    color: Color,
    format?: QuantizeFormat
  ): Color;

  export function nearestColorIndexWithDistance(
    palette: Color[],
    color: Color,
    format?: QuantizeFormat
  ): [number, number];

  export function snapColorsToPalette(
    palette: Color[],
    knownColors: Color[],
    threshold?: number
  ): void;

  export default GIFEncoder;
}
