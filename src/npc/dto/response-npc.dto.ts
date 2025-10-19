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
    example: {
      name: 'Gandalf',
      level: 10,
      hp: 80,
      ac: 15,
      // imageUrl: 'https://d12345.cloudfront.net/.../gandalf.png',
    },
    description:
      'TRPG NPC/몬스터 데이터. 구조는 룰북(dnd5e, coc7e 등)에 따라 동적입니다.\n' +
      '※ **`imageUrl` 필드는 선택적입니다**. 이미지가 업로드된 경우에만 포함됩니다.\n' +
      '※ 클라이언트는 이 필드의 존재 여부를 확인 후 처리해야 합니다.\n' +
      '※ 예시에는 일반적인 필드만 표시되며, 실제 응답에는 더 많은 필드가 포함될 수 있습니다.',
  })
  data: object;

  @ApiProperty({
    enum: TrpgSystem,
    example: TrpgSystem.DND5E,
    description: '룰북 타입 (dnd5e, coc7e 등)',
  })
  trpgType: TrpgSystem;

  @ApiProperty({
    enum: NpcType,
    example: NpcType.NPC,
    description: 'NPC 또는 몬스터 타입',
  })
  type: NpcType;

  @ApiProperty({
    example: false,
    description:
      '공개 여부 (true: 모든 참여자 조회 가능, false: GM만 조회 가능)',
  })
  isPublic: boolean;

  @ApiProperty({
    example: '4dff4c7b-96c6-4dd8-bdac-c73fd08ab5b0',
    description: '소속 방 UUID',
  })
  roomId: string;

  @ApiProperty({
    example: '2025-04-01T00:00:00.000Z',
    description: '생성일',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2025-04-01T00:00:00.000Z',
    description: '수정일',
  })
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
