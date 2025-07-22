import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  ParseIntPipe,
} from '@nestjs/common';
import { RoomService } from './room.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { User } from '@/users/entities/user.entity';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { RoomParticipantDto } from './dto/room-participant.dto';

@Controller('rooms')
@UseGuards(JwtAuthGuard)
export class RoomController {
  constructor(private readonly roomService: RoomService) { }

  // 방 생성
  @Post()
  async createRoom(
    @Body() dto: CreateRoomDto,
    @Req() req: { user: User },
  ) {
    const creatorId = req.user.id;
    return this.roomService.createRoom(dto, creatorId);
  }

  // 방 참여
  @Post(':id/join')
  async joinRoom(
    @Param('id', ParseIntPipe) roomId: number,
    @Req() req: { user: User },
    @Body('password') password?: string,
  ) {
    const userId = req.user.id;
    return this.roomService.joinRoom(roomId, userId, password);
  }

  // 방 참여자 목록 조회
  @Get(':id/participants')
  async getParticipants(
    @Param('id') roomId: number,
  ): Promise<RoomParticipantDto[]> {
    return this.roomService.getParticipants(roomId);
  }
}