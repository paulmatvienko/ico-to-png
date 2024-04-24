import { toDataView } from './to-data-view.util';
import { BmpDecoder } from './bmp-decoder.util';
import { ImageData } from './image-data.util';

type THotspot = {
  x: number;
  y: number;
};

export interface IBmpData extends ImageData {
  bpp: number;
  hotspot: THotspot | null;
  type: 'bmp';
}

export interface IPngData {
  bpp: number;
  data: Uint8Array;
  height: number;
  hotspot: THotspot | null;
  type: 'png';
  width: number;
}

export class IcoDecoder {
  private static isPng(view: DataView, offset: number) {
    return (
      view.getUint32(offset) === 0x89504e47 &&
      view.getUint32(offset + 4) === 0x0d0a1a0a
    );
  }

  private static pngBitsPerPixel(view: DataView, offset: number) {
    const bitDepth = view.getUint8(offset + 24);
    const colorType = view.getUint8(offset + 25);

    if (colorType === 0) return bitDepth;
    if (colorType === 2) return bitDepth * 3;
    if (colorType === 3) return bitDepth;
    if (colorType === 4) return bitDepth * 2;
    if (colorType === 6) return bitDepth * 4;

    throw new Error('Invalid PNG colorType');
  }

  private static pngWidth(view: DataView, offset: number) {
    return view.getUint32(offset + 16, false);
  }

  private static pngHeight(view: DataView, offset: number) {
    return view.getUint32(offset + 20, false);
  }

  public static decode(
    input: ArrayBuffer | Int8Array | Uint8Array | Uint8ClampedArray,
  ): (IPngData | IBmpData)[] {
    const view = toDataView(input);

    if (view.byteLength < 6) {
      throw new Error('Truncated header');
    }

    if (this.isPng(view, 0)) {
      return [
        {
          bpp: this.pngBitsPerPixel(view, 0),
          data: new Uint8Array(view.buffer, view.byteOffset, view.byteLength),
          height: this.pngHeight(view, 0),
          hotspot: null,
          type: 'png',
          width: this.pngWidth(view, 0),
        },
      ];
    }

    if (view.getUint16(0, true) !== 0) {
      throw new Error('Invalid magic bytes');
    }

    const type = view.getUint16(2, true);

    if (type !== 1 && type !== 2) {
      throw new Error('Invalid image type');
    }

    const length = view.getUint16(4, true);

    if (view.byteLength < 6 + 16 * length) {
      throw new Error('Truncated image list');
    }

    return Array.from({ length }, (_, idx) => {
      const width = view.getUint8(6 + 16 * idx);
      const height = view.getUint8(6 + 16 * idx + 1);
      const size = view.getUint32(6 + 16 * idx + 8, true);
      const offset = view.getUint32(6 + 16 * idx + 12, true);

      const hotspot =
        type !== 2
          ? null
          : {
              x: view.getUint16(6 + 16 * idx + 4, true),
              y: view.getUint16(6 + 16 * idx + 6, true),
            };

      if (this.isPng(view, offset)) {
        return {
          bpp: this.pngBitsPerPixel(view, offset),
          data: new Uint8Array(view.buffer, view.byteOffset + offset, size),
          height: this.pngHeight(view, offset),
          hotspot,
          type: 'png',
          width: this.pngWidth(view, offset),
        } as IPngData;
      }

      const data = new Uint8Array(view.buffer, view.byteOffset + offset, size);
      const bmp = BmpDecoder.decode(data, { width, height, icon: true });
      const info = { bpp: bmp.colorDepth, hotspot, type: 'bmp' };

      return Object.assign(
        new ImageData(bmp.data, bmp.width, bmp.height),
        info,
      ) as IBmpData;
    });
  }
}
