// src/charactersheet/dto/create-character-sheet.dto.ts
import { IsObject, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCharacterSheetDto {
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
