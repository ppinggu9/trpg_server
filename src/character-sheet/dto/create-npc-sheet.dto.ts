import { IsObject, IsBoolean, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateNpcSheetDto {
  @ApiProperty({ type: Object, description: 'NPC/몬스터 시트 데이터' })
  @IsObject()
  data: object;

  @ApiProperty({
    example: false,
    description: '다른 플레이어가 볼 수 있는지 여부',
  })
  @IsBoolean()
  isPublic: boolean;

  @ApiProperty({ enum: ['npc', 'monster'], example: 'monster' })
  @IsEnum(['npc', 'monster'])
  type: 'npc' | 'monster';
}
