// src/charactersheet/dto/character-sheet-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { TrpgSystem } from '@/common/enums/trpg-system.enum';
import { CharacterSheet } from '../entities/character-sheet.entity';

export class CharacterSheetResponseDto {
  @ApiProperty({ example: 1, description: '캐릭터 시트 고유 ID' })
  id: number;

  @ApiProperty({
    type: Object,
    description: 'TRPG 시트 데이터 (프론트엔드에서 계산된 모든 값 포함)',
  })
  data: object;

  @ApiProperty({
    enum: TrpgSystem,
    description: '룰북 타입 (dnd5e, coc7e 등)',
  })
  trpgType: TrpgSystem;

  @ApiProperty({
    example: false,
    description: '다른 플레이어가 볼 수 있는지 여부',
  })
  isPublic: boolean;

  @ApiProperty({ example: 1, description: '방 참가자 ID' })
  participantId: number;

  @ApiProperty({ example: '2025-04-01T00:00:00.000Z', description: '생성일' })
  createdAt: Date;

  @ApiProperty({ example: '2025-04-01T00:00:00.000Z', description: '수정일' })
  updatedAt: Date;

  static fromEntity(entity: CharacterSheet): CharacterSheetResponseDto {
    return {
      id: entity.id,
      data: entity.data,
      trpgType: entity.trpgType,
      isPublic: entity.isPublic,
      participantId: entity.participant.id,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
