import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
import { ROOM_ERRORS } from '../constants/room.constants';

export class JoinRoomDto {
  @ApiProperty({
    description: '방 비밀번호',
    example: '123',
  })
  @IsString()
  @MinLength(1, { message: ROOM_ERRORS.PASSWORD_REQUIRED })
  password: string;
}
