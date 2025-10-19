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
import { DeleteVttMapResponseDto } from './dto/delete-vttmap-response.dto';

@ApiTags('VttMaps')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller('vttmaps')
export class VttMapController {
  constructor(private readonly vttMapService: VttMapService) {}

  @Post('rooms/:roomId/vttmaps')
  @ApiOperation({
    summary: 'VTT 맵 생성',
    description:
      'GM만 VTT 맵을 생성할 수 있습니다. 방당 여러 맵 허용. **이름 중복 허용**.',
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
      'GM 전용 vttmap 이미지를 업로드하기 위한 Presigned URL을 발급합니다.\n' +
      '1. 이 엔드포인트로 `presignedUrl`과 `publicUrl`을 받습니다.\n' +
      '2. 클라이언트가 `presignedUrl`로 S3에 이미지 PUT 요청\n' +
      '3. 성공 시, **반드시 `publicUrl`을 vttmap의 imageUrl 필드에 저장**하세요.',
  })
  @ApiParam({ name: 'roomId', type: 'string', format: 'uuid' })
  @ApiBody({ type: CreatePresignedUrlDto })
  @ApiCreatedResponse({ type: PresignedUrlResponseDto }) // ✅ 일관성 유지
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
    type: DeleteVttMapResponseDto,
  })
  @ApiUnauthorizedResponse({ description: '인증되지 않음' })
  @ApiForbiddenResponse({ description: VTTMAP_ERRORS.NOT_ROOM_CREATOR })
  @ApiNotFoundResponse({ description: VTTMAP_ERRORS.NOT_FOUND })
  async deleteVttMap(
    @Param('mapId', ParseUUIDPipe) mapId: string,
    @Req() req: RequestWithUser,
  ) {
    await this.vttMapService.deleteVttMap(mapId, req.user.id);
    return new DeleteVttMapResponseDto(); // ✅ 명확한 반환
  }
}
