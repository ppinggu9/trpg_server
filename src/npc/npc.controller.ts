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
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { RequestWithUser } from '@/auth/types/request-with-user.dto';
import { NpcService } from './npc.service';
import { CreateNpcDto } from './dto/create-npc.dto';
import { NpcResponseDto } from './dto/response-npc.dto';
import { UpdateNpcDto } from './dto/update-npc.dto';
import { NpcType } from '@/common/enums/npc-type.enum';
import { CreatePresignedUrlDto } from '@/common/dto/create-presigned-url.dto';
import { PresignedUrlResponseDto } from '@/common/dto/presigned-url-response.dto';

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

  @Post('room/:roomId/presigned-url')
  @ApiOperation({
    summary: 'NPC 이미지 업로드용 Presigned URL 발급 (GM 전용)',
    description:
      'NPC/몬스터 이미지를 업로드하기 위한 Presigned URL을 발급합니다. ' +
      '반환된 `presignedUrl`로 클라이언트가 직접 S3에 PUT 요청 후, ' +
      '`publicUrl`을 NPC의 `data` 필드에 저장하세요.',
  })
  @ApiParam({
    name: 'roomId',
    type: String,
    format: 'uuid',
    description: '대상 방의 UUID',
  })
  @ApiBody({ type: CreatePresignedUrlDto })
  @ApiOkResponse({
    description: 'Presigned URL 발급 성공',
    type: PresignedUrlResponseDto,
    content: {
      'application/json': {
        example: {
          presignedUrl:
            'https://your-bucket.s3.ap-northeast-2.amazonaws.com/uploads/npcs/room-123/abc123.png?X-Amz-Signature=xyz',
          publicUrl:
            'https://d12345.cloudfront.net/uploads/npcs/room-123/abc123.png',
          key: 'uploads/npcs/room-123/abc123.png',
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description:
      '다음 중 하나의 이유로 요청이 거부됨:\n' +
      '- `contentType`이 허용되지 않는 MIME 타입임 (허용: image/jpeg, image/png, image/webp)\n' +
      '- `fileName`의 확장자가 허용되지 않음 (.jpg, .jpeg, .png, .webp만 허용)\n' +
      '- `fileName` 확장자와 `contentType`이 서로 일치하지 않음',
  })
  @ApiForbiddenResponse({
    description: '요청 사용자가 해당 방의 GM이 아님',
  })
  @ApiNotFoundResponse({
    description:
      '해당 roomId의 방이 존재하지 않음 또는 사용자가 방에 참여하지 않음',
  })
  async getPresignedUrlForNpcImage(
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Body() body: CreatePresignedUrlDto,
    @Req() req: RequestWithUser,
  ): Promise<PresignedUrlResponseDto> {
    return this.npcService.getPresignedUrlForNpcImage(
      roomId,
      body.fileName,
      body.contentType,
      req.user.id,
    );
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
