import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  ParseUUIDPipe,
  Req,
  HttpCode,
  HttpStatus,
  Query,
  Delete,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { VttMapService } from './vttmap.service';
import { CreateVttMapDto } from './dto/create-vttmap.dto';
import { VttMapResponseDto } from './dto/vttmap-response.dto';
import { VttMapDto } from './dto/vttmap.dto';
import { RequestWithUser } from '@/auth/types/request-with-user.dto';
import { CreatePresignedUrlDto } from '@/common/dto/create-presigned-url.dto';
import { PresignedUrlResponseDto } from '@/common/dto/presigned-url-response.dto';
import { UpdateVttMapDto } from './dto/update-vttmap.dto';
import { VTTMAP_ERRORS, VTTMAP_MESSAGES } from './constants/vttmap.constants';

@ApiTags('VttMaps')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller('vttmaps')
export class VttMapController {
  constructor(private readonly vttMapService: VttMapService) {}

  @Post('rooms/:roomId/vttmaps')
  @ApiOperation({
    summary: 'VTT 맵 생성',
    description: '방장(GM)만 VTT 맵을 생성할 수 있습니다. 방당 여러 맵 허용.',
  })
  @ApiParam({
    name: 'roomId',
    type: 'string',
    format: 'uuid',
    description: '맵을 생성할 방의 UUID',
  })
  @ApiBody({ type: CreateVttMapDto })
  @ApiCreatedResponse({
    description: 'VTT 맵이 성공적으로 생성되었습니다.',
    type: VttMapResponseDto,
  })
  @ApiBadRequestResponse({ description: '요청 데이터 유효성 검사 실패' })
  @ApiUnauthorizedResponse({ description: '인증되지 않음' })
  @ApiForbiddenResponse({ description: VTTMAP_ERRORS.NOT_ROOM_CREATOR })
  @ApiNotFoundResponse({ description: '방을 찾을 수 없음' })
  async createVttMap(
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Req() req: RequestWithUser,
    @Body() dto: CreateVttMapDto,
  ) {
    const result = await this.vttMapService.createVttMap(
      roomId,
      req.user.id,
      dto,
    );
    return VttMapResponseDto.fromEntity(result.message, result.vttMap);
  }

  @Post('rooms/:roomId/vttmaps/presigned-url')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'VTT 맵 이미지 업로드용 Presigned URL 발급',
    description:
      'GM 전용. 클라이언트는 반환된 `presignedUrl`로 S3에 PUT 후, `publicUrl`을 `imageUrl`에 저장',
  })
  @ApiParam({ name: 'roomId', type: 'string', format: 'uuid' })
  @ApiBody({ type: CreatePresignedUrlDto })
  @ApiResponse({
    status: 201,
    type: PresignedUrlResponseDto,
  })
  @ApiBadRequestResponse({ description: '잘못된 이미지 형식' })
  @ApiUnauthorizedResponse({ description: '인증되지 않음' })
  @ApiForbiddenResponse({ description: VTTMAP_ERRORS.NOT_ROOM_CREATOR })
  @ApiNotFoundResponse({ description: '방 없음 또는 참여 안 함' })
  async getPresignedUrlForVttMapImage(
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Body() body: CreatePresignedUrlDto,
    @Req() req: RequestWithUser,
  ): Promise<PresignedUrlResponseDto> {
    return this.vttMapService.getPresignedUrlForVttMapImage(
      roomId,
      body.fileName,
      body.contentType,
      req.user.id,
    );
  }

  @Get(':mapId')
  @ApiOperation({
    summary: 'VTT 맵 단건 조회',
    description: '특정 맵 정보를 조회합니다. 방 참여자만 접근 가능.',
  })
  @ApiParam({
    name: 'mapId',
    type: 'string',
    format: 'uuid',
    description: '맵 ID',
  })
  @ApiOkResponse({
    description: '맵 조회 성공',
    type: VttMapResponseDto,
  })
  @ApiUnauthorizedResponse({ description: '인증되지 않음' })
  @ApiForbiddenResponse({ description: VTTMAP_ERRORS.PARTICIPANT_NOT_IN_ROOM })
  @ApiNotFoundResponse({ description: VTTMAP_ERRORS.NOT_FOUND })
  async getVttMap(
    @Param('mapId', ParseUUIDPipe) mapId: string,
    @Req() req: RequestWithUser,
  ) {
    const vttMap = await this.vttMapService.getVttMap(mapId, req.user.id);
    return VttMapResponseDto.fromEntity(VTTMAP_MESSAGES.RETRIEVED, vttMap);
  }

  @Get()
  @ApiOperation({
    summary: '방 내 VTT 맵 목록 조회',
    description: '특정 방에 속한 모든 맵을 조회합니다.',
  })
  @ApiQuery({ name: 'roomId', required: true, type: 'string', format: 'uuid' })
  @ApiOkResponse({
    description: '맵 목록 조회 성공',
    type: [VttMapDto],
  })
  @ApiUnauthorizedResponse({ description: '인증되지 않음' })
  @ApiForbiddenResponse({ description: VTTMAP_ERRORS.PARTICIPANT_NOT_IN_ROOM })
  @ApiNotFoundResponse({ description: '방을 찾을 수 없음' })
  async getVttMapsByRoom(
    @Query('roomId', ParseUUIDPipe) roomId: string,
    @Req() req: RequestWithUser,
  ) {
    const vttMaps = await this.vttMapService.getVttMapsByRoomId(
      roomId,
      req.user.id,
    );
    return vttMaps.map(VttMapDto.fromEntity);
  }

  @Patch(':mapId')
  @ApiOperation({
    summary: 'VTT 맵 설정 업데이트',
    description: 'GM 전용. 특정 맵의 설정을 수정합니다.',
  })
  @ApiParam({ name: 'mapId', type: 'string', format: 'uuid' })
  @ApiBody({ type: UpdateVttMapDto })
  @ApiOkResponse({
    description: '맵 업데이트 성공',
    type: VttMapResponseDto,
  })
  @ApiBadRequestResponse({ description: '유효성 검사 실패' })
  @ApiUnauthorizedResponse({ description: '인증되지 않음' })
  @ApiForbiddenResponse({ description: VTTMAP_ERRORS.NOT_ROOM_CREATOR })
  @ApiNotFoundResponse({ description: VTTMAP_ERRORS.NOT_FOUND })
  async updateVttMap(
    @Param('mapId', ParseUUIDPipe) mapId: string,
    @Req() req: RequestWithUser,
    @Body() dto: UpdateVttMapDto,
  ) {
    const result = await this.vttMapService.updateVttMap(
      mapId,
      req.user.id,
      dto,
    );
    return VttMapResponseDto.fromEntity(result.message, result.vttMap);
  }

  @Delete(':mapId')
  @ApiOperation({
    summary: 'VTT 맵 삭제 (Soft Delete)',
    description: 'GM 전용. 특정 맵을 논리적으로 삭제합니다.',
  })
  @ApiParam({ name: 'mapId', type: 'string', format: 'uuid' })
  @ApiOkResponse({
    description: '맵 삭제 성공',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: '맵이 삭제되었습니다.' },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: '인증되지 않음' })
  @ApiForbiddenResponse({ description: VTTMAP_ERRORS.NOT_ROOM_CREATOR })
  @ApiNotFoundResponse({ description: VTTMAP_ERRORS.NOT_FOUND })
  async deleteVttMap(
    @Param('mapId', ParseUUIDPipe) mapId: string,
    @Req() req: RequestWithUser,
  ) {
    await this.vttMapService.deleteVttMap(mapId, req.user.id);
    return {
      success: true,
      message: '맵이 삭제되었습니다.',
    };
  }
}
