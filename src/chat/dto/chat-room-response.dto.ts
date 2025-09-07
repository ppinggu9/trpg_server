// src/chat/dto/chat-room-response.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import {
  IsNumber,
  IsString,
  IsBoolean,
  IsDate,
  IsArray,
} from 'class-validator';
import { ChatRoom } from '../entities/chat-room.entity';

export class ChatRoomResponseDto {
  @ApiProperty({ example: 123 })
  @IsNumber()
  id: number;

  @ApiProperty({ example: 'TRPG Party #1', nullable: true })
  @IsString()
  name: string | null;

  @ApiProperty({ example: true })
  @IsBoolean()
  isActive: boolean;

  @ApiProperty({ example: '2024-06-07T10:00:00.000Z' })
  @IsDate()
  createdAt: Date;

  @ApiProperty({ example: 101, description: '방 생성자 ID' })
  @IsNumber()
  creatorId: number;

  @ApiProperty({
    example: [101, 102, 103],
    description: '참여자 ID 목록',
    type: [Number],
  })
  @IsArray()
  participantIds: number[];

  static async fromEntity(
    room: ChatRoom,
    participantIds: number[],
  ): Promise<ChatRoomResponseDto> {
    const dto = new ChatRoomResponseDto();
    dto.id = room.id;
    dto.name = room.name;
    dto.isActive = room.isActive;
    dto.createdAt = room.createdAt;
    dto.creatorId = room.creator.id;
    dto.participantIds = participantIds;
    return dto;
  }
}
