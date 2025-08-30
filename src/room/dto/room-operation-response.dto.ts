import { ApiProperty } from '@nestjs/swagger';
import { RoomResponseDto } from './room-response.dto';

export class RoomOperationResponseDto {
  @ApiProperty({
    description: '작업 결과 메시지',
  })
  message: string;

  @ApiProperty({
    description: '방 정보',
    type: RoomResponseDto,
  })
  room: RoomResponseDto;

  constructor(message: string, room: RoomResponseDto) {
    this.message = message;
    this.room = room;
  }
}
