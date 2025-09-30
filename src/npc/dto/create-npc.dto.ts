// src/npc/dto/create-npc.dto.ts
import { IsObject, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateNpcDto {
  @ApiProperty({
    type: Object,
    description: 'NPC/몬스터 시트 데이터',
  })
  @IsObject()
  data: object;

  @ApiProperty({
    example: false,
    description: '초기 공개 여부 설정 (GM 전용)',
  })
  @IsBoolean()
  isPublic: boolean;
}
