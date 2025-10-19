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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiBody,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiQuery,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiUnauthorizedResponse,
  ApiResponse,
} from '@nestjs/swagger';
import { RequestWithUser } from '@/auth/types/request-with-user.dto';
import { NpcService } from './npc.service';
import { CreateNpcDto } from './dto/create-npc.dto';
import { NpcResponseDto } from './dto/response-npc.dto';
import { UpdateNpcDto } from './dto/update-npc.dto';
import { NpcType } from '@/common/enums/npc-type.enum';
import { CreatePresignedUrlDto } from '@/common/dto/create-presigned-url.dto';
import { PresignedUrlResponseDto } from '@/common/dto/presigned-url-response.dto';
import { NPC_ERRORS, NPC_MESSAGES } from './constants/npc.constants';
import { DeleteNpcResponseDto } from './dto/delete-npc-response.dto';

@ApiTags('NPCs')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller('npcs')
export class NpcController {
  constructor(private readonly npcService: NpcService) {}

  @Post('room/:roomId')
  @ApiOperation({
    summary: 'NPC 생성',
    description: '방(GM)에서 새로운 NPC를 생성합니다.',
  })
  @ApiParam({
    name: 'roomId',
    type: 'string',
    format: 'uuid',
    description: 'NPC를 생성할 방의 UUID',
  })
  @ApiBody({ type: CreateNpcDto })
  @ApiCreatedResponse({
    description: 'NPC 생성 성공',
    type: NpcResponseDto,
  })
  @ApiBadRequestResponse({
    description: '잘못된 요청 (유효성 검사 실패)',
  })
  @ApiUnauthorizedResponse({
    description: '인증되지 않은 사용자',
  })
  @ApiForbiddenResponse({
    description: NPC_ERRORS.GM_REQUIRED,
  })
  @ApiNotFoundResponse({
    description: '방을 찾을 수 없음',
  })
  async create(
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Body() dto: CreateNpcDto,
    @Req() req: RequestWithUser,
  ) {
    const npc = await this.npcService.createNpc(roomId, dto, req.user.id);
    console.log(
      `[DEBUG NPC.create] Created NPC for room ${roomId}, GM ${req.user.id}:`,
      {
        id: npc.id,
        type: npc.type,
        isPublic: npc.isPublic,
        roomId: npc.roomId,
        trpgType: npc.trpgType,
        data: npc.data,
      },
    );
    return NpcResponseDto.fromEntity(npc);
  }

  @Post('room/:roomId/presigned-url')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'NPC 이미지 업로드용 Presigned URL 발급 (GM 전용)',
    description:
      'NPC/몬스터 이미지를 업로드하기 위한 Presigned URL을 발급합니다.\n' +
      '1. 클라이언트가 `presignedUrl`로 S3에 이미지 업로드\n' +
      '2. 성공 시, **선택적으로** `publicUrl`을 NPC의 `data.imageUrl`에 저장\n' +
      '※ 저장하지 않으면 NPC에 이미지가 표시되지 않습니다.',
  })
  @ApiParam({
    name: 'roomId',
    type: String,
    format: 'uuid',
    description: '대상 방의 UUID',
  })
  @ApiBody({ type: CreatePresignedUrlDto })
  @ApiResponse({
    status: 201,
    description: 'Presigned URL이 성공적으로 발급되었습니다.',
    type: PresignedUrlResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      '다음 중 하나의 이유로 요청이 거부됨:\n' +
      '- `contentType`이 허용되지 않는 MIME 타입임 (허용: image/jpeg, image/png, image/webp)\n' +
      '- `fileName`의 확장자가 허용되지 않음 (.jpg, .jpeg, .png, .webp만 허용)\n' +
      '- `fileName` 확장자와 `contentType`이 서로 일치하지 않음',
  })
  @ApiUnauthorizedResponse({
    description: '인증되지 않은 사용자',
  })
  @ApiForbiddenResponse({
    description: NPC_ERRORS.GM_REQUIRED,
  })
  @ApiNotFoundResponse({
    description: '방을 찾을 수 없음 또는 사용자가 방에 참여하지 않음',
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
  @ApiOperation({
    summary: 'NPC 단건 조회',
    description:
      '다음 조건 중 하나를 만족하면 조회 가능:\n' +
      '- 요청자가 방의 GM인 경우 (공개/비공개 모두 조회 가능)\n' +
      '- NPC가 공개 상태(`isPublic: true`)인 경우 (일반 참여자도 조회 가능)\n' +
      '비공개 NPC에 대한 접근은 GM만 허용됩니다.',
  })
  @ApiParam({
    name: 'npcId',
    type: 'number',
    description: '조회할 NPC의 ID',
  })
  @ApiOkResponse({
    description: 'NPC 조회 성공',
    type: NpcResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: '인증되지 않은 사용자',
  })
  @ApiForbiddenResponse({
    description: NPC_ERRORS.READ_FORBIDDEN,
  })
  @ApiNotFoundResponse({
    description: NPC_ERRORS.NOT_FOUND,
  })
  async findOne(
    @Param('npcId', ParseIntPipe) npcId: number,
    @Req() req: RequestWithUser,
  ) {
    const npc = await this.npcService.getNpc(npcId, req.user.id);
    console.log(
      `[DEBUG NPC.findOne] Loaded NPC ${npcId} for user ${req.user.id}:`,
      {
        id: npc.id,
        type: npc.type,
        isPublic: npc.isPublic,
        roomId: npc.roomId,
        trpgType: npc.trpgType,
        data: npc.data,
      },
    );
    return NpcResponseDto.fromEntity(npc);
  }

  @Patch(':npcId')
  @ApiOperation({
    summary: 'NPC 수정',
    description: 'NPC 정보를 수정합니다. GM 전용 기능입니다.',
  })
  @ApiParam({
    name: 'npcId',
    type: 'number',
    description: '수정할 NPC의 ID',
  })
  @ApiBody({ type: UpdateNpcDto })
  @ApiOkResponse({
    description: 'NPC 수정 성공',
    type: NpcResponseDto,
  })
  @ApiBadRequestResponse({
    description: '잘못된 요청 (유효성 검사 실패)',
  })
  @ApiUnauthorizedResponse({
    description: '인증되지 않은 사용자',
  })
  @ApiForbiddenResponse({
    description: NPC_ERRORS.GM_REQUIRED,
  })
  @ApiNotFoundResponse({
    description: NPC_ERRORS.NOT_FOUND,
  })
  async update(
    @Param('npcId', ParseIntPipe) npcId: number,
    @Body() dto: UpdateNpcDto,
    @Req() req: RequestWithUser,
  ) {
    const npc = await this.npcService.updateNpc(npcId, dto, req.user.id);
    console.log(
      `[DEBUG NPC.update] Updated NPC ${npcId} by user ${req.user.id}:`,
      {
        id: npc.id,
        type: npc.type,
        isPublic: npc.isPublic,
        roomId: npc.roomId,
        trpgType: npc.trpgType,
        data: npc.data,
      },
    );
    return NpcResponseDto.fromEntity(npc);
  }

  @Delete(':npcId')
  @ApiOperation({
    summary: 'NPC 삭제 (Soft Delete)',
    description: 'NPC가 성공적으로 삭제됨 (논리적 삭제)',
  })
  @ApiParam({
    name: 'npcId',
    type: 'number',
    description: '삭제할 NPC의 ID',
  })
  @ApiOkResponse({
    description: 'NPC 삭제 성공',
    type: DeleteNpcResponseDto,
  })
  @ApiUnauthorizedResponse({ description: '인증되지 않은 사용자' })
  @ApiForbiddenResponse({ description: NPC_ERRORS.GM_REQUIRED })
  @ApiNotFoundResponse({ description: NPC_ERRORS.NOT_FOUND })
  async remove(
    @Param('npcId', ParseIntPipe) npcId: number,
    @Req() req: RequestWithUser,
  ) {
    await this.npcService.deleteNpc(npcId, req.user.id);
    return {
      success: true,
      message: NPC_MESSAGES.DELETED,
    };
  }

  @Get()
  @ApiOperation({
    summary: '방 내 NPC 목록 조회',
    description:
      '특정 방에 속한 NPC 목록을 조회합니다. 일반 참여자는 공개된 NPC만 볼 수 있습니다.',
  })
  @ApiQuery({
    name: 'roomId',
    type: 'string',
    format: 'uuid',
    required: true,
    description: '방 UUID',
  })
  @ApiQuery({
    name: 'type',
    enum: NpcType,
    required: false,
    description: 'NPC 유형으로 필터링 (선택 사항)',
  })
  @ApiOkResponse({
    description: 'NPC 목록 조회 성공',
    type: [NpcResponseDto],
  })
  @ApiUnauthorizedResponse({
    description: '인증되지 않은 사용자',
  })
  @ApiForbiddenResponse({
    description: NPC_ERRORS.PARTICIPANT_NOT_IN_ROOM,
  })
  @ApiNotFoundResponse({
    description: '방을 찾을 수 없음',
  })
  async getNpcsByRoom(
    @Query('roomId', ParseUUIDPipe) roomId: string,
    @Req() req: RequestWithUser,
    @Query('type', new ParseEnumPipe(NpcType, { optional: true }))
    type?: NpcType,
  ) {
    const npcs = await this.npcService.getNpcsByRoom(roomId, req.user.id, type);
    console.log(
      `[DEBUG getNpcsByRoom] Found ${npcs.length} NPCs for room ${roomId}, user ${req.user.id}, type filter: ${type}`,
      npcs.map((n) => ({
        id: n.id,
        type: n.type,
        isPublic: n.isPublic,
        roomId: n.roomId,
      })),
    );
    return npcs.map(NpcResponseDto.fromEntity);
  }
}
