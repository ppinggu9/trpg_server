import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsInt } from 'class-validator';

export class CreateTokenDto {
  @ApiProperty({ example: 'Goblin', description: '토큰 이름' })
  @IsString()
  name: string;

  @ApiProperty({ example: 100, description: 'X 좌표 (화면 기준)' })
  @IsNumber()
  x: number;

  @ApiProperty({ example: 200, description: 'Y 좌표 (화면 기준)' })
  @IsNumber()
  y: number;

  @ApiPropertyOptional({ example: 1.2, description: '스케일 (기본값: 1.0)' })
  @IsNumber()
  @IsOptional()
  scale?: number;

  @ApiPropertyOptional({
    description: '토큰 이미지 URL (선택 사항). 앞뒤 공백은 자동 제거되지 않음.',
    example: 'https://example.com/token.png',
    format: 'uri',
  })
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @ApiPropertyOptional({
    type: Number,
    description: '연결할 캐릭터 시트 ID (NPC와 동시에 지정 불가)',
    example: 123,
    minimum: 1,
  })
  @IsInt()
  @IsOptional()
  characterSheetId?: number;

  @ApiPropertyOptional({
    type: Number,
    description: '연결할 NPC ID (캐릭터 시트와 동시에 지정 불가)',
    example: 456,
    minimum: 1,
  })
  @IsInt()
  @IsOptional()
  npcId?: number;
}
