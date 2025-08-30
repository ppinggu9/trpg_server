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
  ApiUnauthorizedResponse,
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
import { ROOM_MESSAGES } from './constants/room.constants';

@UseGuards(JwtAuthGuard)
@ApiTags('rooms')
@ApiBearerAuth()
@Controller('rooms')
export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  @Post()
  @ApiOperation({
    summary: '방 생성',
    description: '새로운 방(채팅방 역할도 함께)을 생성합니다.',
  })
  @ApiBody({ type: CreateRoomDto })
  @ApiCreatedResponse({
    description: '방 생성 성공',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: ROOM_MESSAGES.CREATED,
        },
        room: {
          $ref: getSchemaPath(RoomResponseDto),
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: '잘못된 요청 (유효성 검사 실패)',
  })
  @ApiUnauthorizedResponse({
    description: '인증되지 않은 사용자',
  })
  @ApiConflictResponse({
    description:
      '이미 다른 방에 참여 중이거나 방 참가 처리 중 다른 요청으로 인해 방이 삭제되었습니다.',
  })
  async createRoom(
    @Body() createRoomDto: CreateRoomDto,
    @Req() req,
  ): Promise<RoomOperationResponseDto> {
    const userId = req.user.id;
    return this.roomService.createRoom(createRoomDto, userId);
  }

  @Post(':roomId/join')
  @ApiOperation({
    summary: '방 참여',
    description: '기존 채팅 방에 참여합니다.',
  })
  @ApiParam({ name: 'roomId', description: '참여할 방의 ID', type: 'string' })
  @ApiBody({ type: JoinRoomDto })
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    description: '방 참여 성공',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: ROOM_MESSAGES.JOINED,
        },
        room: {
          $ref: getSchemaPath(RoomResponseDto),
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description:
      '방이 꽉 찼거나 비밀번호를 입력해주세요 또는 비밀번호가 일치하지 않습니다.',
  })
  @ApiUnauthorizedResponse({
    description: '인증되지 않은 사용자',
  })
  @ApiNotFoundResponse({
    description: '방을 찾을 수 없음',
  })
  async joinRoom(
    @Param('roomId') roomId: string,
    @Body() joinRoomDto: JoinRoomDto,
    @Req() req,
  ): Promise<RoomOperationResponseDto> {
    const userId = req.user.id;
    return this.roomService.joinRoom(roomId, userId, joinRoomDto);
  }

  @Post(':roomId/leave')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: '방 나가기',
    description: '참여 중인 방에서 나갑니다. (방장은 직접 나갈 수 없음)',
  })
  @ApiParam({ name: 'roomId', description: '나갈 방의 ID', type: 'string' })
  @ApiNoContentResponse({
    description: '방 나가기 성공 (멱등성 보장)',
  })
  @ApiForbiddenResponse({
    description: '방장은 직접 방을 나갈 수 없습니다',
  })
  @ApiUnauthorizedResponse({
    description: '인증되지 않은 사용자',
  })
  async leaveRoom(@Param('roomId') roomId: string, @Req() req): Promise<void> {
    const userId = req.user.id;
    await this.roomService.leaveRoom(userId, roomId);
  }

  @Delete(':roomId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: '방 삭제',
    description: '방장만 자신의 방을 삭제할 수 있습니다.',
  })
  @ApiParam({ name: 'roomId', description: '삭제할 방의 ID', type: 'string' })
  @ApiNoContentResponse({
    description: '방 삭제 성공 (멱등성 보장)',
  })
  @ApiUnauthorizedResponse({
    description: '인증되지 않은 사용자',
  })
  @ApiForbiddenResponse({
    description: '방장이 아님',
  })
  async deleteRoom(@Param('roomId') roomId: string, @Req() req): Promise<void> {
    const userId = req.user.id;
    await this.roomService.deleteRoom(roomId, userId);
  }

  @Patch(':roomId/transfer-creator')
  @ApiOperation({
    summary: '방장 권한 위임',
    description: '방장이 다른 참여자에게 방장 권한을 위임합니다.',
  })
  @ApiParam({ name: 'roomId', description: '방 ID', type: 'string' })
  @ApiBody({ type: TransferCreatorDto })
  @ApiOkResponse({
    description: '방장 권한 위임 성공',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: ROOM_MESSAGES.CREATOR_TRANSFERRED,
        },
        room: {
          $ref: getSchemaPath(RoomResponseDto),
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description:
      '잘못된 요청 (대상 사용자가 방에 없음 또는 자신에게 방장 권한을 위임할 수 없습니다)',
  })
  @ApiUnauthorizedResponse({
    description: '인증되지 않은 사용자',
  })
  @ApiForbiddenResponse({
    description: '방장이 아님',
  })
  async transferCreator(
    @Param('roomId') roomId: string,
    @Body() dto: TransferCreatorDto,
    @Req() req,
  ): Promise<RoomOperationResponseDto> {
    const userId = req.user.id;
    return this.roomService.transferCreator(roomId, userId, dto.newCreatorId);
  }

  @Patch(':roomId/participants/:userId/role')
  @ApiOperation({
    summary: '참여자 역할 변경',
    description: '방장이 참여자의 역할을 변경합니다.',
  })
  @ApiParam({ name: 'roomId', description: '방 ID', type: 'string' })
  @ApiParam({ name: 'userId', description: '대상 사용자 ID', type: 'number' })
  @ApiBody({ type: UpdateParticipantRoleDto })
  @ApiOkResponse({
    description: '역할 변경 성공',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: ROOM_MESSAGES.ROLE_UPDATED,
        },
        room: {
          $ref: getSchemaPath(RoomResponseDto),
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description:
      '잘못된 요청 (대상 사용자가 방에 없음 또는 유효하지 않은 역할)',
  })
  @ApiUnauthorizedResponse({
    description: '인증되지 않은 사용자',
  })
  @ApiForbiddenResponse({
    description: '방장이 아님',
  })
  async updateParticipantRole(
    @Param('roomId') roomId: string,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: UpdateParticipantRoleDto,
    @Req() req,
  ): Promise<RoomOperationResponseDto> {
    const currentUserId = req.user.id;
    return this.roomService.updateParticipantRole(
      roomId,
      currentUserId,
      userId,
      dto.role,
    );
  }

  @Get(':roomId')
  @ApiOperation({
    summary: '방 정보 조회',
    description: '방 정보와 참여자 목록을 조회합니다.',
  })
  @ApiParam({ name: 'roomId', description: '조회할 방의 ID', type: 'string' })
  @ApiOkResponse({
    description: '방 정보 조회 성공',
    type: RoomResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: '인증되지 않은 사용자',
  })
  @ApiNotFoundResponse({
    description: '방을 찾을 수 없음',
  })
  async getRoom(
    @Param('roomId', ParseUUIDPipe) roomId: string,
  ): Promise<RoomResponseDto> {
    return this.roomService.getRoomWithParticipants(roomId);
  }
}
