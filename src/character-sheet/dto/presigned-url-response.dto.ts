// presigned-url-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class PresignedUrlResponseDto {
  @ApiProperty({
    format: 'uri',
    example:
      'https://your-bucket.s3.region.amazonaws.com/uploads/...?X-Amz-Signature=...',
    description: 'S3에 직접 PUT 요청을 보내기 위한 Presigned URL',
  })
  presignedUrl: string;

  @ApiProperty({
    format: 'uri',
    example: 'https://d12345.cloudfront.net/uploads/abc123.png',
    description: '업로드 후 외부에서 접근 가능한 공개 URL',
  })
  publicUrl: string;

  @ApiProperty({
    example: 'uploads/abc123.png',
    description: 'S3 내부 키 (클라이언트는 일반적으로 사용하지 않음) = 경로',
  })
  key: string;
}
