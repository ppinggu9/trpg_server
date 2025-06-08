import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { RoomService } from './room.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RoomResponseDto } from './dto/room-response.dto';
import { RoomDetailResponseDto } from './dto/room-detail-response.dto';

@Controller('room')
@UseGuards(JwtAuthGuard)
export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  @Post()
  async createRoom(
    @Body() createRoomDto: CreateRoomDto,
    @Req() req: any,
  ): Promise<RoomResponseDto> {
    const creatorId = parseInt(req.user.id, 10);
    const room = await this.roomService.createRoom(createRoomDto, creatorId);
    return room;
  }

  // 방 참여
  @Post(':id/join')
  async joinRoom(
    @Param('id') roomId: string,
    @Body('password') password: string,
    @Req() req: any,
  ): Promise<void> {
    const userId = req.user.id;
    await this.roomService.joinRoom(roomId, userId, password);
  }

  // 방 검색
  @Get()
  async searchRooms(
    @Query('query') query: string,
    @Query('language') language: string = 'ko_kr',
  ): Promise<RoomResponseDto[]> {
    const rooms = await this.roomService.searchRooms(query, language);
    return rooms;
  }

  // 방 상세 정보 조회
  @Get(':id')
  async getRoomById(@Param('id') id: string): Promise<RoomDetailResponseDto> {
    const room = await this.roomService.getRoomById(id);
    return room;
  }
}
