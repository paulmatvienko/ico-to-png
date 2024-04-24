export class ImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;

  constructor(data: Uint8ClampedArray, width: number, height: number) {
    this.width = width >>> 0;
    this.height = height >>> 0;
    this.data = data;
  }

  static fromOnlyWidthAndHeight(width: number, height: number) {
    return new ImageData(
      new Uint8ClampedArray(width * height * 4),
      width,
      height,
    );
  }
}
