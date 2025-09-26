// src/chat/dto/create-chat-room.dto.ts

import { IsString, IsOptional, IsArray, IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateChatRoomDto {
  @ApiProperty({ example: 'TRPG Party #1', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    example: [101, 102, 103],
    description: '초기 참여자 ID 목록. 생성자 자신은 자동으로 포함됩니다.',
    type: [Number],
  })
  @IsArray()
  @IsInt({ each: true })
  participantIds: number[];
}
