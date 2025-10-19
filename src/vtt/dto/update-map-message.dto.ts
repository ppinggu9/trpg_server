// src/vtt/dto/update-map-message.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { UpdateVttMapDto } from '@/vttmap/dto/update-vttmap.dto';

export class UpdateMapMessageDto {
  @ApiProperty({ format: 'uuid' })
  mapId: string;

  @ApiProperty({ type: UpdateVttMapDto })
  updates: UpdateVttMapDto;
}
