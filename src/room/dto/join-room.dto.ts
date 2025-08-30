import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class JoinRoomDto {
  @ApiProperty({
    description: '방 비밀번호',
    example: '123',
  })
  @IsString()
  password: string;
}
