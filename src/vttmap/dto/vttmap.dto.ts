import { ApiProperty } from '@nestjs/swagger';
import { GridType } from '@/common/enums/grid-type.enum';
import { VttMap } from '../entities/vttmap.entity'; // 엔티티 import

export class VttMapDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ nullable: true })
  name: string;

  @ApiProperty({ nullable: true })
  imageUrl: string;

  @ApiProperty({ enum: GridType })
  gridType: GridType;

  @ApiProperty()
  gridSize: number;

  @ApiProperty()
  showGrid: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ description: '연결된 방 ID' })
  roomId: string;

  static fromEntity(entity: VttMap): VttMapDto {
    return {
      id: entity.id,
      name: entity.name,
      imageUrl: entity.imageUrl,
      gridType: entity.gridType,
      gridSize: entity.gridSize,
      showGrid: entity.showGrid,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      roomId: entity.roomId,
    };
  }
}
