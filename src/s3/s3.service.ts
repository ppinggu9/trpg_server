// s3/s3.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class S3Service {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly cloudFrontDomain: string;

  constructor(private readonly configService: ConfigService) {
    const region = this.configService.get<string>('AWS_REGION');
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>(
      'AWS_SECRET_ACCESS_KEY',
    );
    this.bucketName = this.configService.get<string>('S3_BUCKET_NAME');
    this.cloudFrontDomain = this.configService.get<string>('CLOUDFRONT_DOMAIN');

    // IAM Role(인스턴스활성화 O) 을 쓰는게 권장
    const credentials =
      accessKeyId && secretAccessKey
        ? {
            accessKeyId,
            secretAccessKey,
          }
        : undefined;

    this.s3Client = new S3Client({
      region,
      credentials,
    });
  }

  /**
   * 클라이언트가 S3에 직접 업로드할 수 있는 Presigned PUT URL 생성
   * @param key S3 객체 키 (예: "avatars/user123.png")
   * @param contentType 업로드할 파일의 MIME 타입 (보안을 위해 서버에서 검증 후 전달)
   * @param expiresIn 만료 시간 (초, 기본 900 = 15분)
   */
  async getPresignedPutUrl(
    key: string,
    contentType: string,
    expiresIn: number = 900,
  ): Promise<string> {
    // 호출자가 검증하도록 할것
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType,
    });

    return getSignedUrl(this.s3Client, command, {
      expiresIn,
      signableHeaders: new Set(['content-type']),
    });
  }

  validateImageExtension(key: string): void {
    if (!key.startsWith('uploads/')) {
      throw new Error('Invalid key prefix');
    }
    const allowedExts = ['.jpg', '.jpeg', '.png', '.webp'];
    const lowerKey = key.toLowerCase();
    if (!allowedExts.some((ext) => lowerKey.endsWith(ext))) {
      throw new Error('Invalid file extension');
    }
  }

  getCloudFrontUrl(key: string): string {
    if (!this.cloudFrontDomain) {
      throw new Error('CLOUDFRONT_DOMAIN is not configured');
    }
    return `https://${this.cloudFrontDomain}/${key}`;
  }

  getBucketName(): string {
    return this.bucketName;
  }

  // // 테스트를 위한 업로드 함수
  // async uploadObject(key: string, body: Buffer | string, contentType?: string) {
  //   const command = new PutObjectCommand({
  //     Bucket: this.bucketName,
  //     Key: key,
  //     Body: body,
  //     ContentType: contentType,
  //   });
  //   return this.s3Client.send(command);
  // }
}
