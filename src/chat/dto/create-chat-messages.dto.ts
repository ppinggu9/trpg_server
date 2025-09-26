// src/chat/dto/create-chat-messages.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class CreateChatMessageDto {
  @ApiProperty({ example: 101, description: '발신자 사용자 ID' })
  @IsInt()
  senderId: number; // <-- 핵심: 각 메시지마다 다른 발신자 ID를 가질 수 있음

  @ApiProperty({ example: 'Hello, everyone!' })
  @IsString()
  content: string;

  @ApiProperty({ example: '2024-06-07T10:00:00.000Z' })
  @IsString()
  sentAt: string;
}

export class CreateChatMessagesDto {
  @ApiProperty({ example: 123, description: '채팅방 ID' })
  @IsInt()
  roomId: number;

  @ApiProperty({ type: [CreateChatMessageDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateChatMessageDto)
  messages: CreateChatMessageDto[];
}
