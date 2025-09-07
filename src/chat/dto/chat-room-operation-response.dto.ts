// src/chat/dto/chat-room-operation-response.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { ChatRoomResponseDto } from './chat-room-response.dto';

export class ChatRoomOperationResponseDto {
  @ApiProperty({ example: 'Chat room created successfully.' })
  message: string;

  @ApiProperty({ type: ChatRoomResponseDto })
  room: ChatRoomResponseDto;
}
