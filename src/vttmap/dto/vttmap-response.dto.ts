import { ApiProperty } from '@nestjs/swagger';
import { VttMapDto } from './vttmap.dto';
import { VttMap } from '../entities/vttmap.entity';

export class VttMapResponseDto {
  @ApiProperty({ description: '응답 메시지' })
  message: string;

  @ApiProperty({ type: VttMapDto })
  vttMap: VttMapDto;

  private constructor(message: string, vttMap: VttMapDto) {
    this.message = message;
    this.vttMap = vttMap;
  }

  static fromEntity(message: string, vttmapEntity: VttMap): VttMapResponseDto {
    const vttMapDto: VttMapDto = {
      id: vttmapEntity.id,
      name: vttmapEntity.name,
      imageUrl: vttmapEntity.imageUrl,
      gridType: vttmapEntity.gridType,
      gridSize: vttmapEntity.gridSize,
      showGrid: vttmapEntity.showGrid,
      createdAt: vttmapEntity.createdAt,
      updatedAt: vttmapEntity.updatedAt,
      roomId: vttmapEntity.roomId,
    };

    return new VttMapResponseDto(message, vttMapDto);
  }
}
