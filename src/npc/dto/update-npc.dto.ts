// src/npc/dto/update-npc.dto.ts
import { IsObject, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateNpcDto {
  @ApiProperty({
    type: Object,
    description: '갱신할 NPC/몬스터 데이터',
  })
  @IsObject()
  data: object;

  @ApiProperty({
    example: true,
    description: '공개 여부 (GM 전용, 생략 가능)',
  })
  @IsBoolean()
  isPublic?: boolean;
}
