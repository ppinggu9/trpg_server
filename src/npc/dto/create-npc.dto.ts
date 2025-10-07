// src/npc/dto/create-npc.dto.ts
import { IsObject, IsBoolean, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { NpcType } from '@/common/enums/npc-type.enum';

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

  @IsEnum(NpcType)
  @ApiProperty({
    enum: NpcType,
    description: 'npc또는 monster로 필터링(선택)',
    default: NpcType.NPC,
  })
  type: NpcType = NpcType.NPC;
}
