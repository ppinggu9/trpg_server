import { ApiProperty } from '@nestjs/swagger';
import { GridType } from '@/common/enums/grid-type.enum';
import { VttMap } from '../entities/vttmap.entity'; // 엔티티 import

export class VttMapDto {
  @ApiProperty({
    description: 'VTT 맵 고유 ID (UUID)',
    example: 'a1b2c3d4-e5f6-7890-g1h2-i3j4k5l6m7n8',
  })
  id: string;

  @ApiProperty({
    description: '맵 이름. 공백만 입력 시 API 응답에서 필드가 제외됩니다.',
    nullable: true,
    example: '던전 입구',
  })
  name: string | null;

  @ApiProperty({
    description: '배경 이미지 URL (공백 제거 후 저장, 없으면 null)',
    nullable: true,
    example: 'https://d12345.cloudfront.net/uploads/vttmaps/room123/abc123.jpg',
  })
  imageUrl: string | null;

  @ApiProperty({
    enum: GridType,
    enumName: 'GridType',
    description: '그리드 유형',
    example: GridType.SQUARE,
  })
  gridType: GridType;

  @ApiProperty({
    description: '그리드 한 변의 크기 (픽셀 단위, 10~200)',
    minimum: 10,
    maximum: 200,
    example: 50,
  })
  gridSize: number;

  @ApiProperty({
    description: '그리드 표시 여부',
    example: true,
  })
  showGrid: boolean;

  @ApiProperty({
    description: '생성 시간 (ISO 8601)',
    example: '2025-10-19T12:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: '수정 시간 (ISO 8601)',
    example: '2025-10-19T12:05:00.000Z',
  })
  updatedAt: Date;

  @ApiProperty({
    description: '연결된 방 ID (UUID)',
    example: 'b2c3d4e5-f6g7-8901-h2i3-j4k5l6m7n8o9',
  })
  roomId: string;

  static fromEntity(entity: VttMap): VttMapDto {
    return {
      id: entity.id,
      name: entity.name || null,
      imageUrl: entity.imageUrl || null,
      gridType: entity.gridType,
      gridSize: entity.gridSize,
      showGrid: entity.showGrid,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      roomId: entity.roomId,
    };
  }
}
