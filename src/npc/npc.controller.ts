// src/npc/controllers/npc.controller.ts
import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
  ParseIntPipe,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiBody,
  ApiResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiQuery,
  ApiOkResponse,
} from '@nestjs/swagger';
import { RequestWithUser } from '@/auth/types/request-with-user.dto';
import { NpcService } from './npc.service';
import { CreateNpcDto } from './dto/create-npc.dto';
import { NpcResponseDto } from './dto/response-npc.dto';
import { UpdateNpcDto } from './dto/update-npc.dto';

@ApiTags('NPCs')
@Controller('npcs')
@UseGuards(JwtAuthGuard)
export class NpcController {
  constructor(private readonly npcService: NpcService) {}

  @Post('room/:roomId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'NPC/몬스터 생성 (GM 전용)' })
  @ApiParam({ name: 'roomId', description: '방 ID' })
  @ApiBody({ type: CreateNpcDto })
  @ApiResponse({ status: 201, type: NpcResponseDto })
  @ApiForbiddenResponse({ description: 'GM이 아님' })
  @ApiNotFoundResponse({ description: '방 없음' })
  async create(
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Body() createDto: CreateNpcDto,
    @Req() req: RequestWithUser,
  ) {
    const npc = await this.npcService.createNpc(roomId, createDto, req.user.id);
    return NpcResponseDto.fromEntity(npc);
  }

  @Get(':npcId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'NPC 조회 (GM 또는 isPublic=true인 경우)' })
  @ApiParam({ name: 'npcId', description: 'NPC ID' })
  @ApiResponse({ status: 200, type: NpcResponseDto })
  @ApiForbiddenResponse({ description: '접근 권한 없음' })
  @ApiNotFoundResponse({ description: 'NPC 없음' })
  async findOne(
    @Param('npcId', ParseIntPipe) npcId: number,
    @Req() req: RequestWithUser,
  ) {
    const npc = await this.npcService.getNpc(npcId, req.user.id);
    return NpcResponseDto.fromEntity(npc);
  }

  @Patch(':npcId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'NPC 업데이트 (GM 전용)' })
  @ApiParam({ name: 'npcId', description: 'NPC ID' })
  @ApiBody({ type: UpdateNpcDto })
  @ApiResponse({ status: 200, type: NpcResponseDto })
  @ApiForbiddenResponse({ description: 'GM이 아님' })
  @ApiNotFoundResponse({ description: 'NPC 없음' })
  async update(
    @Param('npcId', ParseIntPipe) npcId: number,
    @Body() updateDto: UpdateNpcDto,
    @Req() req: RequestWithUser,
  ) {
    const npc = await this.npcService.updateNpc(npcId, updateDto, req.user.id);
    return NpcResponseDto.fromEntity(npc);
  }

  @Delete(':npcId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'NPC 삭제 (GM 전용)' })
  @ApiParam({ name: 'npcId', description: 'NPC ID' })
  @ApiResponse({
    status: 200,
    description: '삭제 성공',
    schema: { type: 'object', properties: { success: { type: 'boolean' } } },
  })
  @ApiForbiddenResponse({ description: 'GM이 아님' })
  @ApiNotFoundResponse({ description: 'NPC 없음' })
  async remove(
    @Param('npcId', ParseIntPipe) npcId: number,
    @Req() req: RequestWithUser,
  ) {
    return this.npcService.deleteNpc(npcId, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: '방별 NPC 목록 조회' })
  @ApiQuery({ name: 'roomId', description: '방 ID', required: true })
  @ApiOkResponse({ type: [NpcResponseDto] })
  @ApiForbiddenResponse({ description: '방에 참여하지 않음 또는 권한 없음' })
  @ApiNotFoundResponse({ description: '방을 찾을 수 없음' })
  async getNpcsByRoom(
    @Query('roomId') roomId: string,
    @Req() req: RequestWithUser,
  ) {
    const npcs = await this.npcService.getNpcsByRoom(roomId, req.user.id);
    return npcs.map(NpcResponseDto.fromEntity);
  }
}
