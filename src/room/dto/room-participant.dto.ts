import { ApiProperty } from '@nestjs/swagger';

export class RoomParticipantDto {
  @ApiProperty({ description: '사용자 ID' })
  id: number;

  @ApiProperty({ description: '사용자 이름' })
  name: string;

  @ApiProperty({ description: '사용자 닉네임' })
  nickname: string;
}