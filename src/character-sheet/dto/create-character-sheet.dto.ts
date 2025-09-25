// src/charactersheet/dto/create-character-sheet.dto.ts
import { IsEnum, IsObject, IsBoolean } from 'class-validator';
import { TrpgSystem } from '@/common/enums/trpg-system.enum';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCharacterSheetDto {
  @ApiProperty({
    enum: TrpgSystem,
    description: '룰북 타입 (dnd5e, coc7e, pathfinder 등)',
  })
  @IsEnum(TrpgSystem)
  trpgType: TrpgSystem;

  @ApiProperty({
    type: Object,
    description: '캐릭터 시트 데이터 (프론트에서 계산된 모든 값 포함)',
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
