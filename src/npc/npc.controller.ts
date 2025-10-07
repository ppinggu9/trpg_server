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
  ParseEnumPipe,
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
import { NpcType } from '@/common/enums/npc-type.enum';

@ApiTags('NPCs')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller('npcs')
export class NpcController {
  constructor(private readonly npcService: NpcService) {}

  @Post('room/:roomId')
  @ApiOperation({ summary: 'NPC 생성 (GM 전용)' })
  @ApiParam({ name: 'roomId', type: 'string' })
  @ApiBody({ type: CreateNpcDto })
  @ApiResponse({ status: 201, type: NpcResponseDto })
  @ApiForbiddenResponse({ description: 'GM이 아님' })
  @ApiNotFoundResponse({ description: '방 없음' })
  async create(
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Body() dto: CreateNpcDto,
    @Req() req: RequestWithUser,
  ) {
    const npc = await this.npcService.createNpc(roomId, dto, req.user.id);
    return NpcResponseDto.fromEntity(npc);
  }

  @Get(':npcId')
  @ApiOperation({ summary: 'NPC 조회' })
  @ApiParam({ name: 'npcId', type: 'number' })
  @ApiResponse({ status: 200, type: NpcResponseDto })
  @ApiForbiddenResponse({ description: '권한 없음' })
  @ApiNotFoundResponse({ description: 'NPC 없음' })
  async findOne(
    @Param('npcId', ParseIntPipe) npcId: number,
    @Req() req: RequestWithUser,
  ) {
    const npc = await this.npcService.getNpc(npcId, req.user.id);
    return NpcResponseDto.fromEntity(npc);
  }

  @Patch(':npcId')
  @ApiOperation({ summary: 'NPC 업데이트 (GM 전용)' })
  @ApiParam({ name: 'npcId', type: 'number' })
  @ApiBody({ type: UpdateNpcDto })
  @ApiResponse({ status: 200, type: NpcResponseDto })
  @ApiForbiddenResponse({ description: 'GM이 아님' })
  @ApiNotFoundResponse({ description: 'NPC 없음' })
  async update(
    @Param('npcId', ParseIntPipe) npcId: number,
    @Body() dto: UpdateNpcDto,
    @Req() req: RequestWithUser,
  ) {
    const npc = await this.npcService.updateNpc(npcId, dto, req.user.id);
    return NpcResponseDto.fromEntity(npc);
  }

  @Delete(':npcId')
  @ApiOperation({ summary: 'NPC 삭제 (GM 전용)' })
  @ApiParam({ name: 'npcId', type: 'number' })
  @ApiResponse({
    status: 200,
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
  @ApiQuery({ name: 'roomId', required: true, type: String })
  @ApiOkResponse({ type: [NpcResponseDto] })
  @ApiForbiddenResponse({ description: '방에 참여하지 않음' })
  @ApiNotFoundResponse({ description: '방 없음' })
  async getNpcsByRoom(
    @Query('roomId', ParseUUIDPipe) roomId: string,
    @Req() req: RequestWithUser,
    @Query('type', new ParseEnumPipe(NpcType, { optional: true }))
    type?: NpcType,
  ) {
    const npcs = await this.npcService.getNpcsByRoom(roomId, req.user.id, type);
    return npcs.map(NpcResponseDto.fromEntity);
  }
}
