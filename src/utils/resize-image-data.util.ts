import { ImageData } from './image-data.util';

type TImage = {
  width: number;
  height: number;
  data: Uint8Array | Uint8ClampedArray | number[];
};

export class ResizeImageData {
  private static nearestNeighbor(source: TImage, result: ImageData) {
    let pos = 0;

    for (let y = 0; y < result.height; y++) {
      for (let x = 0; x < result.width; x++) {
        const srcX = Math.floor((x * source.width) / source.width);
        const srcY = Math.floor((y * source.height) / source.height);

        let srcPos = (srcY * source.width + srcX) * 4;

        result.data[pos++] = source.data[srcPos++]; // R
        result.data[pos++] = source.data[srcPos++]; // G
        result.data[pos++] = source.data[srcPos++]; // B
        result.data[pos++] = source.data[srcPos++]; // A
      }
    }
  }

  private static bilinearInterpolation(source: TImage, result: ImageData) {
    function interpolate(
      k: number,
      kMin: number,
      kMax: number,
      vMin: number,
      vMax: number,
    ) {
      if (kMin === kMax) return vMin; // Directly return vMin if no range exists
      return Math.round(((k - kMin) / (kMax - kMin)) * (vMax - vMin) + vMin);
    }

    function interpolateHorizontal(
      offset: number,
      x: number,
      y: number,
      xMin: number,
      xMax: number,
    ) {
      const vMin = source.data[(y * source.width + xMin) * 4 + offset];
      if (xMin === xMax) {
        return vMin;
      }
      const vMax = source.data[(y * source.width + xMax) * 4 + offset];
      return interpolate(x, xMin, xMax, vMin, vMax);
    }

    function interpolateVertical(
      offset: number,
      x: number,
      xMin: number,
      xMax: number,
      y: number,
      yMin: number,
      yMax: number,
    ) {
      const vMin = interpolateHorizontal(offset, x, yMin, xMin, xMax);
      if (yMin === yMax) {
        return vMin;
      }
      const vMax = interpolateHorizontal(offset, x, yMax, xMin, xMax);
      return interpolate(y, yMin, yMax, vMin, vMax);
    }

    let pos = 0;
    for (let y = 0; y < result.height; y++) {
      for (let x = 0; x < result.width; x++) {
        const srcX = (x * source.width) / result.width;
        const srcY = (y * source.height) / result.height;
        const xMin = Math.floor(srcX);
        const yMin = Math.floor(srcY);
        const xMax = Math.min(Math.ceil(srcX), source.width - 1);
        const yMax = Math.min(Math.ceil(srcY), source.height - 1);

        result.data[pos++] = interpolateVertical(
          0,
          srcX,
          xMin,
          xMax,
          srcY,
          yMin,
          yMax,
        ); // R
        result.data[pos++] = interpolateVertical(
          1,
          srcX,
          xMin,
          xMax,
          srcY,
          yMin,
          yMax,
        ); // G
        result.data[pos++] = interpolateVertical(
          2,
          srcX,
          xMin,
          xMax,
          srcY,
          yMin,
          yMax,
        ); // B
        result.data[pos++] = interpolateVertical(
          3,
          srcX,
          xMin,
          xMax,
          srcY,
          yMin,
          yMax,
        ); // A
      }
    }
  }

  public static resize(
    image: TImage,
    width: number,
    height: number,
    algorithm:
      | 'nearest-neighbor'
      | 'bilinear-interpolation' = 'bilinear-interpolation',
  ) {
    const resizeFunction =
      algorithm === 'nearest-neighbor'
        ? ResizeImageData.nearestNeighbor
        : ResizeImageData.bilinearInterpolation;

    const result = ImageData.fromOnlyWidthAndHeight(width, height);

    resizeFunction(image, result);

    return result;
  }
}
