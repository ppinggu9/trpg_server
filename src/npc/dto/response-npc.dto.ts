// src/npc/dto/npc-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { TrpgSystem } from '@/common/enums/trpg-system.enum';
import { Npc } from '../entities/npc.entity';
import { NpcType } from '@/common/enums/npc-type.enum';

export class NpcResponseDto {
  @ApiProperty({ example: 1, description: 'NPC 고유 ID' })
  id: number;

  @ApiProperty({
    type: Object,
    description: 'TRPG NPC/몬스터 데이터',
  })
  data: object;

  @ApiProperty({
    enum: TrpgSystem,
    description: '룰북 타입',
  })
  trpgType: TrpgSystem;

  @ApiProperty({ enum: NpcType, description: 'NPC 또는 몬스터 타입' })
  type: NpcType;

  @ApiProperty({
    example: false,
    description: '공개 여부',
  })
  isPublic: boolean;

  @ApiProperty({ example: 1, description: '방 ID' })
  roomId: string;

  @ApiProperty({ example: '2025-04-01T00:00:00.000Z', description: '생성일' })
  createdAt: Date;

  @ApiProperty({ example: '2025-04-01T00:00:00.000Z', description: '수정일' })
  updatedAt: Date;

  static fromEntity(entity: Npc): NpcResponseDto {
    // console.log(
    //   `[NPC DTO DEBUG] NPC ID ${entity.id} loaded type:`,
    //   entity.type,
    // );
    return {
      id: entity.id,
      data: entity.data,
      trpgType: entity.trpgType,
      type: entity.type,
      isPublic: entity.isPublic,
      roomId: entity.roomId,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
