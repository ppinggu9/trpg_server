// create-presigned-url.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsIn } from 'class-validator';

export class CreatePresignedUrlDto {
  @ApiProperty({
    example: 'avatar.png',
    description: '업로드할 파일의 원본 이름 (확장자 포함)',
  })
  @IsNotEmpty()
  @IsString()
  fileName: string;

  @ApiProperty({
    example: 'image/png',
    enum: ['image/jpeg', 'image/png', 'image/webp'],
    description: '파일의 MIME 타입',
  })
  @IsNotEmpty()
  @IsString()
  @IsIn(['image/jpeg', 'image/png', 'image/webp'], {
    message: '지원하지 않는 파일 형식입니다.',
  })
  contentType: string;
}
