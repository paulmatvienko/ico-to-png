import { toDataView } from './to-data-view.util';
import { ImageData } from './image-data.util';

class Bitmap {
  format: string;
  offset: number;
  depth: number;
  stride: number;
  size: number;
  data: ArrayBuffer | Int8Array | Uint8Array | Uint8ClampedArray;

  private static makeDivisibleByFour(input: number) {
    const rest = input % 4;

    return rest ? input + 4 - rest : input;
  }

  constructor(
    data: ArrayBuffer | Int8Array | Uint8Array | Uint8ClampedArray,
    offset: number,
    {
      width,
      height,
      colorDepth,
      format,
    }: {
      width: number;
      height: number;
      colorDepth: number;
      format: string;
    },
  ) {
    this.format = format;
    this.offset = offset;
    this.depth = colorDepth;
    this.stride = Bitmap.makeDivisibleByFour((width * this.depth) / 8);
    this.size = this.stride * height;
    this.data = data.slice(this.offset, this.offset + this.size);

    if (this.size !== this.data.byteLength) {
      throw new Error('Truncated bitmap data');
    }
  }

  get(x: number, y: number, channel: string) {
    const idx = this.format.indexOf(channel);

    if (this.depth === 1) {
      const slice = this.data[y * this.stride + ((x / 8) | 0)];
      const mask = 1 << (7 - (x % 8));

      return (slice & mask) >> (7 - (x % 8));
    }

    if (this.depth === 2) {
      const slice = this.data[y * this.stride + ((x / 4) | 0)];
      const mask = 3 << (6 - (x % 4) * 2);

      return (slice & mask) >>> (6 - (x % 4) * 2);
    }

    if (this.depth === 4) {
      const slice = this.data[y * this.stride + ((x / 2) | 0)];
      const mask = 15 << (4 - (x % 2) * 4);

      return (slice & mask) >>> (4 - (x % 2) * 4);
    }

    return this.data[y * this.stride + x * (this.depth / 8) + idx];
  }
}

export class BmpDecoder {
  private static decodeTrueColorBmp(
    data: ArrayBuffer | Int8Array | Uint8Array | Uint8ClampedArray,
    {
      width,
      height,
      colorDepth,
      icon,
    }: {
      width: number;
      height: number;
      colorDepth: number;
      icon: boolean;
    },
  ) {
    if (colorDepth !== 32 && colorDepth !== 24) {
      throw new Error(`A color depth of ${colorDepth} is not supported`);
    }

    const xor = new Bitmap(data, 0, {
      width,
      height,
      colorDepth,
      format: 'BGRA',
    });

    const and =
      colorDepth === 24 && icon
        ? new Bitmap(data, xor.offset + xor.size, {
            width,
            height,
            colorDepth: 1,
            format: 'A',
          })
        : null;

    const result = new Uint8Array(width * height * 4);

    let idx = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        result[idx++] = xor.get(x, height - y - 1, 'R');
        result[idx++] = xor.get(x, height - y - 1, 'G');
        result[idx++] = xor.get(x, height - y - 1, 'B');

        if (colorDepth === 32) {
          result[idx++] = xor.get(x, height - y - 1, 'A');
        } else {
          result[idx++] = and && and.get(x, height - y - 1, 'A') ? 0 : 255;
        }
      }
    }

    return new Uint8ClampedArray(
      result.buffer,
      result.byteOffset,
      result.byteLength,
    );
  }

  private static decodePaletteBmp(
    data: ArrayBuffer | Int8Array | Uint8Array | Uint8ClampedArray,
    {
      width,
      height,
      colorDepth,
      colorCount,
      icon,
    }: {
      width: number;
      height: number;
      colorDepth: number;
      colorCount: number;
      icon: boolean;
    },
  ) {
    if (
      colorDepth !== 8 &&
      colorDepth !== 4 &&
      colorDepth !== 2 &&
      colorDepth !== 1
    ) {
      throw new Error(`A color depth of ${colorDepth} is not supported`);
    }

    const colors = new Bitmap(data, 0, {
      width: colorCount,
      height: 1,
      colorDepth: 32,
      format: 'BGRA',
    });

    const xor = new Bitmap(data, colors.offset + colors.size, {
      width,
      height,
      colorDepth,
      format: 'C',
    });

    const and = icon
      ? new Bitmap(data, xor.offset + xor.size, {
          width,
          height,
          colorDepth: 1,
          format: 'A',
        })
      : null;

    const result = new Uint8Array(width * height * 4);

    let idx = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const colorIndex = xor.get(x, height - y - 1, 'C');

        result[idx++] = colors.get(colorIndex, 0, 'R');
        result[idx++] = colors.get(colorIndex, 0, 'G');
        result[idx++] = colors.get(colorIndex, 0, 'B');
        result[idx++] = and && and.get(x, height - y - 1, 'A') ? 0 : 255;
      }
    }

    return new Uint8ClampedArray(
      result.buffer,
      result.byteOffset,
      result.byteLength,
    );
  }

  private static checkMagicBytes(bytes: number) {
    if (bytes !== 0x4d42)
      throw new Error(`Invalid magic byte 0x${bytes.toString(16)}`);
  }

  public static decode(
    source: ArrayBuffer | Int8Array | Uint8Array | Uint8ClampedArray,
    { width: iconWidth = 0, height: iconHeight = 0, icon = false } = {},
  ) {
    const data = toDataView(source);

    let headerSize: number;
    let bitmapWidth: number;
    let bitmapHeight: number;
    let colorDepth: number;
    let colorCount: number;

    if (icon) {
      headerSize = data.getUint32(0, true);
      bitmapWidth = data.getUint32(4, true) | 0;
      bitmapHeight = (data.getUint32(8, true) / 2) | 0;
      colorDepth = data.getUint16(14, true);
      colorCount = data.getUint32(32, true);
    } else {
      BmpDecoder.checkMagicBytes(data.getUint16(0, true));
      headerSize = 14 + data.getUint32(14, true);
      bitmapWidth = data.getUint32(18, true);
      bitmapHeight = data.getUint32(22, true);
      colorDepth = data.getUint16(28, true);
      colorCount = data.getUint32(46, true);
    }

    if (colorCount === 0 && colorDepth <= 8) {
      colorCount = 1 << colorDepth;
    }

    const width = bitmapWidth === 0 ? iconWidth : bitmapWidth;
    const height = bitmapHeight === 0 ? iconHeight : bitmapHeight;

    const bitmapData = new Uint8Array(
      data.buffer,
      data.byteOffset + headerSize,
      data.byteLength - headerSize,
    );

    const result = colorCount
      ? BmpDecoder.decodePaletteBmp(bitmapData, {
          width,
          height,
          colorDepth,
          colorCount,
          icon,
        })
      : BmpDecoder.decodeTrueColorBmp(bitmapData, {
          width,
          height,
          colorDepth,
          icon,
        });

    return Object.assign(new ImageData(result, width, height), { colorDepth });
  }
}
