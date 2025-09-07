// src/chat/chat.controller.ts

import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { ChatService } from './chat.service';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { ChatRoomOperationResponseDto } from './dto/chat-room-operation-response.dto';
import { CreateChatMessagesDto } from './dto/create-chat-messages.dto';
import { CreateChatRoomDto } from './dto/create-chat-room.dto';
import { MessageResponseDto } from './dto/message-response.dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { RequestWithUser } from '@/auth/types/request-with-user.dto';

@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiTags('chat')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  // 1. 채팅방 생성
  @Post('rooms')
  @ApiOperation({ summary: '새로운 채팅방 생성' })
  @ApiBody({ type: CreateChatRoomDto })
  @ApiResponse({
    status: 201,
    description: '채팅방 생성 성공',
    type: ChatRoomOperationResponseDto,
  })
  async createRoom(
    @Body() createRoomDto: CreateChatRoomDto,
    @Req() req: RequestWithUser,
  ): Promise<ChatRoomOperationResponseDto> {
    const userId = req.user.id;
    const room = await this.chatService.createChatRoom(userId, createRoomDto);
    return {
      message: 'Chat room created successfully.',
      room: room,
    };
  }

  // 2. 메시지 배치 저장
  @Post('messages')
  @ApiOperation({ summary: '여러 메시지를 한 번에 저장' })
  @ApiBody({ type: CreateChatMessagesDto })
  @ApiResponse({
    status: 201,
    description: '메시지 저장 성공',
    type: [MessageResponseDto],
  })
  async createMessages(
    @Body() createMessagesDto: CreateChatMessagesDto,
    @Req() req: RequestWithUser,
  ): Promise<MessageResponseDto[]> {
    const userId = req.user.id;
    return this.chatService.createMessages(userId, createMessagesDto);
  }

  // 3. 방의 최근 메시지 조회
  @Get('rooms/:roomId/messages')
  @ApiOperation({ summary: '특정 방의 최근 메시지 목록 조회' })
  @ApiParam({ name: 'roomId', description: '조회할 채팅방 ID', type: 'number' })
  @ApiResponse({
    status: 200,
    description: '메시지 조회 성공',
    type: [MessageResponseDto],
  })
  async getRecentMessages(
    @Param('roomId', ParseIntPipe) roomId: number,
    @Req() req: RequestWithUser,
  ): Promise<MessageResponseDto[]> {
    const userId = req.user.id;
    return this.chatService.getRecentMessages(userId, roomId);
  }

  // 4. 채팅방 삭제
  @Delete('rooms/:roomId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '채팅방 삭제 (방장만 가능)' })
  @ApiParam({ name: 'roomId', description: '삭제할 채팅방 ID', type: 'number' })
  @ApiResponse({ status: 204, description: '채팅방 삭제 성공' })
  async deleteRoom(
    @Param('roomId', ParseIntPipe) roomId: number,
    @Req() req: RequestWithUser,
  ): Promise<void> {
    const userId = req.user.id;
    await this.chatService.deleteChatRoom(userId, roomId);
  }

  // 5. 사용자 초대 API
  @Post('rooms/:roomId/invite')
  @ApiOperation({ summary: '채팅방에 사용자 초대 (방장만 가능)' })
  @ApiParam({ name: 'roomId', description: '초대할 채팅방 ID', type: 'number' })
  @ApiBody({ type: InviteUserDto })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiResponse({ status: 204, description: '사용자 초대 성공' })
  @ApiResponse({
    status: 400,
    description: '잘못된 요청 (존재하지 않는 사용자 또는 이미 참여 중)',
  })
  @ApiResponse({ status: 403, description: '권한 없음 (방장이 아님)' })
  async inviteUser(
    @Param('roomId', ParseIntPipe) roomId: number,
    @Body() inviteUserDto: InviteUserDto,
    @Req() req: RequestWithUser,
  ): Promise<void> {
    const inviterId = req.user.id;
    await this.chatService.inviteUser(inviterId, roomId, inviteUserDto.userId);
  }

  // 6. 사용자 퇴장 API
  @Delete('rooms/:roomId/users/:userId')
  @ApiOperation({ summary: '채팅방에서 사용자 퇴장 (방장 또는 본인만 가능)' })
  @ApiParam({
    name: 'roomId',
    description: '퇴장시킬 채팅방 ID',
    type: 'number',
  })
  @ApiParam({
    name: 'userId',
    description: '퇴장시킬 사용자 ID',
    type: 'number',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiResponse({ status: 204, description: '사용자 퇴장 성공' })
  @ApiResponse({
    status: 400,
    description: '잘못된 요청 (해당 사용자가 방에 없음)',
  })
  @ApiResponse({
    status: 403,
    description: '권한 없음 (방장 또는 본인이 아님)',
  })
  async removeUser(
    @Param('roomId', ParseIntPipe) roomId: number,
    @Param('userId', ParseIntPipe) targetUserId: number,
    @Req() req: RequestWithUser,
  ): Promise<void> {
    const requesterId = req.user.id;
    await this.chatService.removeUser(requesterId, roomId, targetUserId);
  }
}
