// src/npc/dto/update-npc.dto.ts
import { IsObject, IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { NpcType } from '@/common/enums/npc-type.enum';

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
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;

  @IsEnum(NpcType)
  @IsOptional()
  @ApiProperty({
    enum: NpcType,
    description: 'NPC 또는 몬스터 타입',
    required: false,
  })
  type?: NpcType;
}
