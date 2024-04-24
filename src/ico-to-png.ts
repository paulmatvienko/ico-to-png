import { encode, decode } from 'lodepng';
import { IBmpData, IcoDecoder, IPngData } from './utils/ico-decoder.util';
import { ResizeImageData } from './utils/resize-image-data.util';
import { ImageData } from './utils/image-data.util';

export class IcoToPng {
  private static convertToPng(
    image: IPngData | IBmpData | ImageData,
  ): Promise<Buffer> {
    if (image instanceof ImageData) {
      return encode(image);
    } else if (image.type === 'png') {
      return Promise.resolve(
        Buffer.from(
          image.data.buffer,
          image.data.byteLength,
          image.data.byteOffset,
        ),
      );
    } else {
      return encode(image);
    }
  }

  private static convertToImageData(
    image: IPngData | IBmpData | ImageData,
  ): Promise<ImageData> {
    if (image instanceof ImageData) {
      return Promise.resolve(image);
    } else if (image.type === 'png') {
      return decode(Buffer.from(image.data));
    } else {
      return Promise.resolve(image);
    }
  }

  public static convert = async (
    source: Buffer,
    size: number,
    options: { scaleUp?: boolean } = { scaleUp: false },
  ) => {
    const images = IcoDecoder.decode(source);
    const imagesWithScore = images.map((item) => ({ image: item, score: 0 }));

    for (const item of imagesWithScore) {
      item.score = 0;

      if (item.image.width === size) {
        item.score++;
      }

      if (item.image.width >= size) {
        item.score++;
      }

      if (item.image.width % size === 0) {
        item.score++;
      }

      item.score += 1 - 1 / item.image.width;
    }

    const bestImage = imagesWithScore.reduce((a, b) => {
      return a.score >= b.score ? a : b;
    });

    if (bestImage.image.width === size) {
      return this.convertToPng(bestImage.image);
    }

    if (bestImage.image.width < size && !options.scaleUp) {
      return this.convertToPng(bestImage.image);
    }

    return this.convertToImageData(bestImage.image).then((image) => {
      return this.convertToPng(ResizeImageData.resize(image, size, size));
    });
  };
}
