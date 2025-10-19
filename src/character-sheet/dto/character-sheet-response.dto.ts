import { ApiProperty } from '@nestjs/swagger';
import { TrpgSystem } from '@/common/enums/trpg-system.enum';
import { CharacterSheet } from '../entities/character-sheet.entity';

export class CharacterSheetResponseDto {
  @ApiProperty({
    example: 1,
    description: '캐릭터 시트 고유 ID',
  })
  id: number;

  @ApiProperty({
    example: 5,
    description: '방 참가자 ID (participantId)',
  })
  participantId: number;

  @ApiProperty({
    example: 3,
    description: '시트 소유자 사용자 ID (ownerId)',
  })
  ownerId: number;

  @ApiProperty({
    enum: TrpgSystem,
    example: TrpgSystem.DND5E,
    description: '룰북 타입 (dnd5e, coc7e 등)',
  })
  trpgType: TrpgSystem;

  @ApiProperty({
    example: false,
    description: '다른 플레이어가 볼 수 있는지 여부',
  })
  isPublic: boolean;

  @ApiProperty({
    type: Object,
    example: {
      name: 'Legolas',
      level: 5,
      // imageUrl:
      //   'https://d12345.cloudfront.net/uploads/characters/.../avatar.png',
      class: 'Ranger',
      race: 'Elf',
      hp: 45,
      ac: 16,
      str: 10,
      dex: 18,
      con: 14,
      int: 12,
      wis: 16,
      cha: 13,
      skills: ['Perception', 'Stealth'],
      inventory: ['Longbow', 'Shortsword', 'Leather Armor'],
    },
    description:
      'TRPG 시트 데이터. 다음 필드를 포함할 수 있습니다:\n' +
      '- `imageUrl`: 캐릭터 아바타 또는 시트 이미지 URL (선택 사항)\n' +
      '- 룰북별 능력치, 장비, 기술 등 동적 필드',
  })
  data: object;

  @ApiProperty({
    example: '2025-04-01T00:00:00.000Z',
    description: '생성일',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2025-04-02T10:30:00.000Z',
    description: '수정일',
  })
  updatedAt: Date;

  static fromEntity(entity: CharacterSheet): CharacterSheetResponseDto {
    const participant = entity.participant;
    if (!participant || !participant.user) {
      throw new Error(
        'CharacterSheet entity must be loaded with relations: participant, participant.user',
      );
    }

    return {
      id: entity.id,
      participantId: participant.id,
      ownerId: participant.user.id,
      trpgType: entity.trpgType,
      isPublic: entity.isPublic,
      data: entity.data,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
