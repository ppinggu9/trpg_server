import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateTokenDto {
  @ApiPropertyOptional({
    example: 'Updated Goblin',
    description: '토큰 이름 (변경 시에만 포함)',
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    example: 300,
    description: '새로운 X 좌표 (변경 시에만 포함)',
  })
  @IsNumber()
  @IsOptional()
  x?: number;

  @ApiPropertyOptional({
    example: 400,
    description: '새로운 Y 좌표 (변경 시에만 포함)',
  })
  @IsNumber()
  @IsOptional()
  y?: number;

  @ApiPropertyOptional({
    example: 1.5,
    description: '새로운 스케일 값 (변경 시에만 포함)',
  })
  @IsNumber()
  @IsOptional()
  scale?: number;

  @ApiPropertyOptional({
    example: 'https://new.com/token.png',
    description:
      '새로운 이미지 URL (변경 시에만 포함). 앞뒤 공백은 그대로 저장됨.',
    format: 'uri',
  })
  @IsString()
  @IsOptional()
  imageUrl?: string;
}
