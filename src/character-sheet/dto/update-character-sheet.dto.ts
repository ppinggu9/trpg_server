// src/charactersheet/dto/update-character-sheet.dto.ts
import { IsObject, IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateCharacterSheetDto {
  @ApiProperty({
    type: Object,
    description: '갱신할 캐릭터 시트 데이터',
  })
  @IsObject()
  data: object;

  @ApiProperty({
    example: true,
    description: '공개 여부 (GM 전용, 생략 가능)',
  })
  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;
}
