import {
  Controller,
  Post,
  Body,
  Param,
  Get,
  Delete,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  Patch,
  ParseIntPipe,
} from '@nestjs/common';
import { RoomService } from './room.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { JoinRoomDto } from './dto/join-room.dto';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
  getSchemaPath,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiNoContentResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { TransferCreatorDto } from './dto/transfer-creator.dto';
import { UpdateParticipantRoleDto } from './dto/updateparticipantrole.dto';
import { RoomOperationResponseDto } from './dto/room-operation-response.dto';
import { RoomResponseDto } from './dto/room-response.dto';
import { ROOM_ERRORS, ROOM_MESSAGES } from './constants/room.constants';
import { RoomParticipantDto } from './dto/room-participant.dto';
import { RequestWithUser } from '@/auth/types/request-with-user.dto';

@UseGuards(JwtAuthGuard)
@ApiTags('rooms')
@ApiBearerAuth()
@Controller('rooms')
export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  @Post()
  @ApiOperation({
    summary: '방 생성',
    description: '새로운 방을 생성합니다.',
  })
  @ApiBody({ type: CreateRoomDto })
  @ApiCreatedResponse({
    description: '방 생성 성공',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: ROOM_MESSAGES.CREATED },
        room: { $ref: getSchemaPath(RoomResponseDto) },
      },
    },
  })
  @ApiBadRequestResponse({ description: '잘못된 요청 (유효성 검사 실패)' })
  @ApiConflictResponse({ description: ROOM_ERRORS.ROOM_JOIN_CONFLICT })
  async createRoom(
    @Body() createRoomDto: CreateRoomDto,
    @Req() req: RequestWithUser,
  ): Promise<RoomOperationResponseDto> {
    return this.roomService.createRoom(createRoomDto, req.user.id);
  }

  @Post(':roomId/join')
  @ApiOperation({
    summary: '방 참여',
    description: '기존 방에 참여합니다.',
  })
  @ApiParam({
    name: 'roomId',
    type: 'string',
    format: 'uuid',
    description: '참여할 방의 UUID',
  })
  @ApiBody({ type: JoinRoomDto })
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    description: '방 참여 성공',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: ROOM_MESSAGES.JOINED },
        room: { $ref: getSchemaPath(RoomResponseDto) },
      },
    },
  })
  @ApiBadRequestResponse({
    description: `${ROOM_ERRORS.ROOM_FULL} 또는 ${ROOM_ERRORS.PASSWORD_REQUIRED} 또는 ${ROOM_ERRORS.PASSWORD_MISMATCH}`,
  })
  @ApiNotFoundResponse({ description: ROOM_ERRORS.NOT_FOUND })
  async joinRoom(
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Body() joinRoomDto: JoinRoomDto,
    @Req() req: RequestWithUser,
  ): Promise<RoomOperationResponseDto> {
    return this.roomService.joinRoom(roomId, req.user.id, joinRoomDto);
  }

  @Post(':roomId/leave')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: '방 나가기',
    description: '참여 중인 방에서 나갑니다. (방장은 직접 나갈 수 없음)',
  })
  @ApiParam({
    name: 'roomId',
    type: 'string',
    format: 'uuid',
    description: '나갈 방의 UUID',
  })
  @ApiNoContentResponse({ description: '방 나가기 성공 (멱등성 보장)' })
  @ApiForbiddenResponse({ description: ROOM_ERRORS.CANNOT_LEAVE_AS_CREATOR })
  async leaveRoom(
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Req() req: RequestWithUser,
  ): Promise<void> {
    await this.roomService.leaveRoom(req.user.id, roomId);
  }

  @Delete(':roomId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: '방 삭제',
    description: '방장만 자신의 방을 삭제할 수 있습니다.',
  })
  @ApiParam({
    name: 'roomId',
    type: 'string',
    format: 'uuid',
    description: '삭제할 방의 UUID',
  })
  @ApiNoContentResponse({ description: '방 삭제 성공 (멱등성 보장)' })
  @ApiForbiddenResponse({ description: ROOM_ERRORS.NOT_ROOM_CREATOR })
  async deleteRoom(
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Req() req: RequestWithUser,
  ): Promise<void> {
    await this.roomService.deleteRoom(roomId, req.user.id);
  }

  @Patch(':roomId/transfer-creator')
  @ApiOperation({
    summary: '방장 권한 위임',
    description: '방장이 다른 참여자에게 방장 권한을 위임합니다.',
  })
  @ApiParam({
    name: 'roomId',
    type: 'string',
    format: 'uuid',
    description: '방 UUID',
  })
  @ApiBody({ type: TransferCreatorDto })
  @ApiOkResponse({
    description: '방장 권한 위임 성공',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: ROOM_MESSAGES.CREATOR_TRANSFERRED },
        room: { $ref: getSchemaPath(RoomResponseDto) },
      },
    },
  })
  @ApiBadRequestResponse({
    description: `${ROOM_ERRORS.CANNOT_TRANSFER_TO_SELF} 또는 ${ROOM_ERRORS.TARGET_NOT_IN_ROOM}`,
  })
  @ApiForbiddenResponse({ description: ROOM_ERRORS.NOT_ROOM_CREATOR })
  async transferCreator(
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Body() dto: TransferCreatorDto,
    @Req() req: RequestWithUser,
  ): Promise<RoomOperationResponseDto> {
    return this.roomService.transferCreator(
      roomId,
      req.user.id,
      dto.newCreatorId,
    );
  }

  @Patch(':roomId/participants/:userId/role')
  @ApiOperation({
    summary: '참여자 역할 변경',
    description: '방장이 참여자의 역할을 변경합니다.',
  })
  @ApiParam({
    name: 'roomId',
    type: 'string',
    format: 'uuid',
    description: '방 UUID',
  })
  @ApiParam({
    name: 'userId',
    type: 'number',
    description: '대상 사용자 ID',
  })
  @ApiBody({ type: UpdateParticipantRoleDto })
  @ApiOkResponse({
    description: '역할 변경 성공',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: ROOM_MESSAGES.ROLE_UPDATED },
        room: { $ref: getSchemaPath(RoomResponseDto) },
      },
    },
  })
  @ApiBadRequestResponse({
    description: `${ROOM_ERRORS.TARGET_NOT_IN_ROOM} 또는 ${ROOM_ERRORS.INVALID_PARTICIPANT_ROLE}`,
  })
  @ApiForbiddenResponse({ description: ROOM_ERRORS.NOT_ROOM_CREATOR })
  async updateParticipantRole(
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: UpdateParticipantRoleDto,
    @Req() req: RequestWithUser,
  ): Promise<RoomOperationResponseDto> {
    return this.roomService.updateParticipantRole(
      roomId,
      req.user.id,
      userId,
      dto.role,
    );
  }

  @Get(':roomId/participants')
  @ApiOperation({
    summary: '참여자 목록만 조회',
    description: '해당 방의 참여자 목록만 반환합니다. (방 정보 제외)',
  })
  @ApiParam({
    name: 'roomId',
    type: 'string',
    format: 'uuid',
    description: '방 UUID',
  })
  @ApiOkResponse({
    description: '참여자 목록 조회 성공',
    type: [RoomParticipantDto],
  })
  @ApiNotFoundResponse({ description: ROOM_ERRORS.NOT_FOUND })
  async getParticipantsOnly(
    @Param('roomId', ParseUUIDPipe) roomId: string,
  ): Promise<RoomParticipantDto[]> {
    return this.roomService.getParticipantsOnly(roomId);
  }

  @Get(':roomId')
  @ApiOperation({
    summary: '방 정보 조회',
    description: '방 정보와 참여자 목록을 조회합니다.',
  })
  @ApiParam({
    name: 'roomId',
    type: 'string',
    format: 'uuid',
    description: '조회할 방의 UUID',
  })
  @ApiOkResponse({
    description: '방 정보 조회 성공',
    type: RoomResponseDto,
  })
  @ApiNotFoundResponse({ description: ROOM_ERRORS.NOT_FOUND })
  async getRoom(
    @Param('roomId', ParseUUIDPipe) roomId: string,
  ): Promise<RoomResponseDto> {
    return this.roomService.getRoomWithParticipants(roomId);
  }
}
