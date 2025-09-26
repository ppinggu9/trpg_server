// src/chat/dto/message-response.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, IsDate } from 'class-validator';
import { ChatMessage } from '../entities/chat-message.entity';

export class MessageResponseDto {
  @ApiProperty({ example: 1, description: '메시지 고유 ID' })
  @IsNumber()
  id: number;

  @ApiProperty({ example: 101, description: '발신자 사용자 ID' })
  @IsNumber()
  senderId: number;

  @ApiProperty({
    example: 'Hello, world!',
    description: '메시지 내용',
  })
  @IsString()
  content: string;

  @ApiProperty({
    example: '2024-06-07T10:00:00.000Z',
    description: '메시지 전송 시간',
  })
  @IsDate()
  sentAt: Date;

  static fromEntity(entity: ChatMessage): MessageResponseDto {
    const dto = new MessageResponseDto();
    dto.id = entity.id;
    dto.senderId = entity.sender.id; // 엔티티의 관계 필드 사용
    dto.content = entity.content;
    dto.sentAt = entity.sentAt;
    return dto;
  }
}
