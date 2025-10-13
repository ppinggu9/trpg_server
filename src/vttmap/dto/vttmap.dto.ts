// dto/map.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { GridType } from '@/common/enums/grid-type.enum';

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
}
