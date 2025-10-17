import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiNoContentResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { TokenResponseDto } from './dto/token-response.dto';
import { CreateTokenDto } from './dto/create-token.dto';
import { UpdateTokenDto } from './dto/update-token.dto';
import { TokenService } from './token.service';
import { RequestWithUser } from '@/auth/types/request-with-user.dto';
import {
  TOKEN_ERROR_MESSAGES,
  TokenErrorCode,
} from './constants/token.constants';

@ApiTags('Tokens')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller('tokens')
export class TokenController {
  constructor(private readonly tokenService: TokenService) {}

  @Post('maps/:mapId')
  @ApiOperation({
    summary: '맵에 새 토큰 생성',
    description:
      'GM은 일반 토큰/NPC 토큰/캐릭터 시트 토큰 모두 생성 가능. 플레이어는 직접 생성 불가 (GM만 가능). ' +
      '캐릭터 시트와 NPC는 동시에 연결할 수 없음.',
  })
  @ApiParam({
    name: 'mapId',
    type: 'string',
    format: 'uuid',
    description: '토큰을 생성할 맵 ID',
  })
  @ApiBody({ type: CreateTokenDto })
  @ApiCreatedResponse({
    description: '토큰이 성공적으로 생성됨',
    type: TokenResponseDto,
  })
  @ApiBadRequestResponse({
    description: TOKEN_ERROR_MESSAGES[TokenErrorCode.BOTH_SHEET_AND_NPC],
  })
  @ApiUnauthorizedResponse({ description: '인증되지 않은 요청' })
  @ApiForbiddenResponse({
    description: TOKEN_ERROR_MESSAGES[TokenErrorCode.NOT_IN_ROOM],
  })
  @ApiNotFoundResponse({
    description: TOKEN_ERROR_MESSAGES[TokenErrorCode.MAP_NOT_FOUND],
  })
  async create(
    @Param('mapId') mapId: string,
    @Body() dto: CreateTokenDto,
    @Req() req: RequestWithUser,
  ): Promise<TokenResponseDto> {
    return this.tokenService.createToken(mapId, dto, req.user.id);
  }

  @Get('maps/:mapId')
  @ApiOperation({
    summary: '특정 맵의 모든 토큰 조회',
    description: '방 참여자라면 누구나 해당 맵의 모든 토큰을 조회할 수 있음.',
  })
  @ApiParam({
    name: 'mapId',
    type: 'string',
    format: 'uuid',
    description: '토큰을 조회할 맵 ID',
  })
  @ApiOkResponse({
    description: '토큰 목록 조회 성공',
    type: [TokenResponseDto],
  })
  @ApiUnauthorizedResponse({ description: '인증되지 않은 요청' })
  @ApiForbiddenResponse({
    description: TOKEN_ERROR_MESSAGES[TokenErrorCode.NOT_IN_ROOM],
  })
  async findAll(
    @Param('mapId') mapId: string,
    @Req() req: RequestWithUser,
  ): Promise<TokenResponseDto[]> {
    return this.tokenService.getTokensByMap(mapId, req.user.id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: '토큰 정보 업데이트 (이동 포함)',
    description:
      'GM은 모든 토큰 수정 가능. 플레이어는 자신의 캐릭터 시트에 연결된 토큰만 수정 가능.',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: '업데이트할 토큰 ID',
  })
  @ApiBody({ type: UpdateTokenDto })
  @ApiOkResponse({
    description: '토큰 업데이트 성공',
    type: TokenResponseDto,
  })
  @ApiUnauthorizedResponse({ description: '인증되지 않은 요청' })
  @ApiForbiddenResponse({
    description: TOKEN_ERROR_MESSAGES[TokenErrorCode.NO_MOVE_PERMISSION],
  })
  @ApiNotFoundResponse({
    description: TOKEN_ERROR_MESSAGES[TokenErrorCode.TOKEN_NOT_FOUND],
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTokenDto,
    @Req() req: RequestWithUser,
  ): Promise<TokenResponseDto> {
    return this.tokenService.updateToken(id, dto, req.user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: '토큰 삭제 (Soft Delete)',
    description:
      'GM은 모든 토큰 삭제 가능. 플레이어는 자신의 캐릭터 시트 토큰만 삭제 가능.',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: '삭제할 토큰 ID',
  })
  @ApiNoContentResponse({ description: '토큰이 성공적으로 삭제됨' })
  @ApiUnauthorizedResponse({ description: '인증되지 않은 요청' })
  @ApiForbiddenResponse({
    description: TOKEN_ERROR_MESSAGES[TokenErrorCode.NO_MOVE_PERMISSION],
  })
  @ApiNotFoundResponse({
    description: TOKEN_ERROR_MESSAGES[TokenErrorCode.TOKEN_NOT_FOUND],
  })
  async remove(
    @Param('id') id: string,
    @Req() req: RequestWithUser,
  ): Promise<void> {
    await this.tokenService.deleteToken(id, req.user.id);
  }
}
