// // src/s3-test.controller.ts
// import {
//   Controller,
//   Post,
//   Body,
//   BadRequestException,
//   //   UseGuards,
// } from '@nestjs/common';
// import { v4 as uuidv4 } from 'uuid';
// import { S3Service } from './s3.service';
// import { ApiBearerAuth } from '@nestjs/swagger';
// // import { JwtAuthGuard } from '@/auth/jwt-auth.guard';

// @ApiBearerAuth()
// @Controller('s3-test')
// export class S3Controller {
//   constructor(private readonly s3Service: S3Service) {}

//   //   // ✅ 방식 1: 서버 직접 업로드 (테스트용) → uploads/로 강제
//   //   @Post('upload-direct')
//   //   @UseInterceptors(FileInterceptor('file'))
//   //   async uploadDirect(@UploadedFile() file: Express.Multer.File) {
//   //     if (!file) {
//   //       return { error: 'No file uploaded' };
//   //     }

//   //     // ✅ 여기를 uploads/로 변경
//   //     const key = `uploads/${uuidv4()}.${this.getExtension(file.originalname)}`;

//   //     await this.s3Service.uploadObject(key, file.buffer, file.mimetype);
//   //     const publicUrl = this.s3Service.getCloudFrontUrl(key);

//   //     return {
//   //       message: 'Uploaded successfully',
//   //       key,
//   //       publicUrl,
//   //     };
//   //   }

//   @Post('get-presigned-url')
//   async getPresignedUrl(
//     @Body('fileName') fileName: string,
//     @Body('contentType') contentType: string,
//   ) {
//     const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
//     if (!allowedTypes.includes(contentType)) {
//       throw new BadRequestException('Invalid content type');
//     }

//     const ext = this.getExtension(fileName);
//     const allowedExts = ['jpg', 'jpeg', 'png', 'webp'];
//     if (!allowedExts.includes(ext)) {
//       throw new BadRequestException('Invalid file extension');
//     }

//     const key = `uploads/${uuidv4()}.${ext === 'jpeg' ? 'jpg' : ext}`;

//     const presignedUrl = await this.s3Service.getPresignedPutUrl(
//       key,
//       contentType,
//     );
//     const publicUrl = this.s3Service.getCloudFrontUrl(key);

//     return {
//       presignedUrl,
//       publicUrl,
//       key,
//     };
//   }

//   private getExtension(filename: string): string {
//     return filename.split('.').pop()?.toLowerCase() || 'bin';
//   }
// }
