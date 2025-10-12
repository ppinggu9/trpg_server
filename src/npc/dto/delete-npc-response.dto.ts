import { ApiProperty } from '@nestjs/swagger';
import { NPC_MESSAGES } from '../constants/npc.constants';

export class DeleteNpcResponseDto {
  @ApiProperty({
    example: true,
    description: '삭제 성공 여부',
  })
  success: boolean;

  @ApiProperty({
    example: NPC_MESSAGES.DELETED,
    description: '삭제 성공 메시지',
  })
  message: string;
}
