// src/common/constants/image-mime-map.ts
import { ImageMimeType } from '@/common/enums/image-mime-type.enum';

export const MIME_TO_EXTENSION: Record<ImageMimeType, string> = {
  [ImageMimeType.JPEG]: 'jpg',
  [ImageMimeType.PNG]: 'png',
  [ImageMimeType.WEBP]: 'webp',
};

export const EXTENSION_TO_MIME: Record<string, ImageMimeType> = {
  jpg: ImageMimeType.JPEG,
  jpeg: ImageMimeType.JPEG,
  png: ImageMimeType.PNG,
  webp: ImageMimeType.WEBP,
};
