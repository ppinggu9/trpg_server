// src/common/utils/validate-image-upload.ts
import { BadRequestException } from '@nestjs/common';
import { ImageMimeType } from '@/common/enums/image-mime-type.enum';
import { EXTENSION_TO_MIME } from '@/common/constants/image-mime-map';
import { IMAGE_UPLOAD_ERRORS } from '../constants/image-upload-errors.constant';

export function validateImageUpload(fileName: string, contentType: string) {
  if (!Object.values(ImageMimeType).includes(contentType as ImageMimeType)) {
    throw new BadRequestException(IMAGE_UPLOAD_ERRORS.INVALID_MIME_TYPE);
  }

  const ext = fileName.split('.').pop()?.toLowerCase();
  if (!ext || !EXTENSION_TO_MIME[ext]) {
    throw new BadRequestException(IMAGE_UPLOAD_ERRORS.INVALID_FILE_EXTENSION);
  }

  const expectedMime = EXTENSION_TO_MIME[ext];
  if (expectedMime !== contentType) {
    throw new BadRequestException(IMAGE_UPLOAD_ERRORS.MIME_EXTENSION_MISMATCH);
  }

  return ext === 'jpeg' ? 'jpg' : ext;
}
