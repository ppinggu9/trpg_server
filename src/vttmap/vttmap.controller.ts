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
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { VttMapService } from './vttmap.service';
import { CreateVttMapDto } from './dto/create-vttmap.dto';
import { VttMapResponseDto } from './dto/vttmap-response.dto';
import { VttMapDto } from './dto/vttmap.dto';
import { RequestWithUser } from '@/auth/types/request-with-user.dto';
import { CreatePresignedUrlDto } from '@/common/dto/create-presigned-url.dto';
import { PresignedUrlResponseDto } from '@/common/dto/presigned-url-response.dto';
import { UpdateVttMapDto } from './dto/update-vttmap.dto';

@ApiTags('VttMaps')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller('rooms/:roomId/vttmaps')
export class VttMapController {
  constructor(private readonly vttMapService: VttMapService) {}

  @Post()
  @ApiOperation({
    summary: 'VTT 맵 생성',
    description:
      '방장(GM)만 VTT 맵을 생성할 수 있습니다. 방당 하나의 맵만 허용됩니다.',
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
    schema: {
      allOf: [
        { $ref: getSchemaPath(VttMapResponseDto) },
        {
          properties: {
            message: { example: 'VTT 맵이 생성되었습니다.' },
            vttMap: { $ref: getSchemaPath(VttMapDto) },
          },
        },
      ],
    },
  })
  @ApiBadRequestResponse({
    description: '요청 데이터가 유효하지 않습니다. (유효성 검사 실패)',
  })
  @ApiUnauthorizedResponse({
    description: '유효한 JWT 토큰이 제공되지 않았습니다.',
  })
  @ApiForbiddenResponse({
    description: '해당 방의 방장(GM)만 이 작업을 수행할 수 있습니다.',
  })
  @ApiNotFoundResponse({ description: '지정된 방을 찾을 수 없습니다.' })
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

  @Post('presigned-url')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'VTT 맵 이미지 업로드용 Presigned URL 발급',
    description:
      'VTT 배경 이미지를 업로드하기 위한 S3 Presigned URL을 발급합니다. ' +
      '클라이언트는 반환된 `presignedUrl`로 직접 S3에 PUT 요청 후, ' +
      '업로드된 이미지의 `publicUrl`을 맵의 `imageUrl` 필드에 저장해야 합니다.',
  })
  @ApiParam({
    name: 'roomId',
    type: 'string',
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
      '- `contentType`이 허용되지 않는 MIME 타입입니다. (허용: image/jpeg, image/png, image/webp)\n' +
      '- `fileName`의 확장자가 허용되지 않습니다. (.jpg, .jpeg, .png, .webp만 허용)\n' +
      '- `fileName` 확장자와 `contentType`이 일치하지 않습니다.',
  })
  @ApiUnauthorizedResponse({
    description: '유효한 JWT 토큰이 제공되지 않았습니다.',
  })
  @ApiForbiddenResponse({
    description: '해당 방의 방장(GM)만 이 작업을 수행할 수 있습니다.',
  })
  @ApiNotFoundResponse({
    description:
      '방을 찾을 수 없거나, 사용자가 해당 방에 참여하고 있지 않습니다.',
  })
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

  @Patch()
  @ApiOperation({
    summary: 'VTT 맵 설정 업데이트',
    description:
      '방장(GM)만 VTT 맵 설정(그리드 타입, 크기, 배경 이미지 등)을 수정할 수 있습니다.',
  })
  @ApiParam({
    name: 'roomId',
    type: 'string',
    format: 'uuid',
    description: '맵을 수정할 방의 UUID',
  })
  @ApiBody({ type: UpdateVttMapDto })
  @ApiOkResponse({
    description: 'VTT 맵 설정이 성공적으로 업데이트되었습니다.',
    schema: {
      allOf: [
        { $ref: getSchemaPath(VttMapResponseDto) },
        {
          properties: {
            message: { example: 'VTT 맵이 업데이트되었습니다.' },
            vttMap: { $ref: getSchemaPath(VttMapDto) },
          },
        },
      ],
    },
  })
  @ApiBadRequestResponse({
    description: '요청 데이터가 유효하지 않습니다. (유효성 검사 실패)',
  })
  @ApiUnauthorizedResponse({
    description: '유효한 JWT 토큰이 제공되지 않았습니다.',
  })
  @ApiForbiddenResponse({
    description: '해당 방의 방장(GM)만 이 작업을 수행할 수 있습니다.',
  })
  @ApiNotFoundResponse({ description: '해당 방에 VTT 맵이 존재하지 않습니다.' })
  async updateVttMap(
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Req() req: RequestWithUser,
    @Body() dto: UpdateVttMapDto,
  ) {
    const result = await this.vttMapService.updateVttMap(
      roomId,
      req.user.id,
      dto,
    );
    return VttMapResponseDto.fromEntity(result.message, result.vttMap);
  }

  @Get()
  @ApiOperation({
    summary: 'VTT 맵 조회',
    description: '해당 방의 VTT 맵 정보를 조회합니다.',
  })
  @ApiParam({
    name: 'roomId',
    type: 'string',
    format: 'uuid',
    description: '조회할 방의 UUID',
  })
  @ApiOkResponse({
    description: 'VTT 맵 정보가 성공적으로 조회되었습니다.',
    schema: {
      allOf: [
        { $ref: getSchemaPath(VttMapResponseDto) },
        {
          properties: {
            message: { example: 'VTT 맵 정보를 조회했습니다.' },
            vttMap: { $ref: getSchemaPath(VttMapDto) },
          },
        },
      ],
    },
  })
  @ApiUnauthorizedResponse({
    description: '유효한 JWT 토큰이 제공되지 않았습니다.',
  })
  @ApiNotFoundResponse({ description: '해당 방에 VTT 맵이 존재하지 않습니다.' })
  async getVttMap(@Param('roomId', ParseUUIDPipe) roomId: string) {
    const vttMap = await this.vttMapService.getVttMapByRoomId(roomId);
    return VttMapResponseDto.fromEntity('VTT 맵 정보를 조회했습니다.', vttMap);
  }
}
