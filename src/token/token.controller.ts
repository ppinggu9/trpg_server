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
} from '@nestjs/common';
import { TokenService } from './token.service';
import { CreateTokenDto } from './dto/create-token.dto';
import { UpdateTokenDto } from './dto/update-token.dto';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { TokenResponseDto } from './dto/token-response.dto';
import {
  TOKEN_ERROR_MESSAGES,
  TokenErrorCode,
} from './constants/token.constants';
import { RequestWithUser } from '@/auth/types/request-with-user.dto';

@ApiTags('Tokens')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller('tokens')
export class TokenController {
  constructor(private readonly tokenService: TokenService) {}

  @Post('maps/:mapId')
  @ApiOperation({ summary: '맵에 새 토큰 생성' })
  @ApiParam({
    name: 'mapId',
    type: 'string',
    format: 'uuid',
    description: '토큰을 생성할 맵 ID',
  })
  @ApiBody({ type: CreateTokenDto })
  @ApiResponse({
    status: 201,
    description: '토큰 생성 성공',
    type: TokenResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: '캐릭터 시트와 NPC를 동시에 연결할 수 없음',
    schema: {
      example: {
        message: TOKEN_ERROR_MESSAGES[TokenErrorCode.BOTH_SHEET_AND_NPC],
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: '해당 맵에 접근 권한 없음',
    schema: {
      example: { message: TOKEN_ERROR_MESSAGES[TokenErrorCode.NOT_IN_ROOM] },
    },
  })
  @ApiResponse({
    status: 404,
    description: '맵을 찾을 수 없음',
    schema: {
      example: { message: TOKEN_ERROR_MESSAGES[TokenErrorCode.MAP_NOT_FOUND] },
    },
  })
  async create(
    @Param('mapId') mapId: string,
    @Body() dto: CreateTokenDto,
    @Req() req: RequestWithUser,
  ): Promise<TokenResponseDto> {
    return this.tokenService.createToken(mapId, dto, req.user.id);
  }

  @Get('maps/:mapId')
  @ApiOperation({ summary: '특정 맵의 모든 토큰 조회' })
  @ApiParam({
    name: 'mapId',
    type: 'string',
    format: 'uuid',
    description: '토큰을 조회할 맵 ID',
  })
  @ApiResponse({
    status: 200,
    description: '토큰 목록 조회 성공',
    type: [TokenResponseDto],
  })
  @ApiResponse({
    status: 403,
    description: '해당 맵에 접근 권한 없음',
    schema: {
      example: { message: TOKEN_ERROR_MESSAGES[TokenErrorCode.NOT_IN_ROOM] },
    },
  })
  async findAll(
    @Param('mapId') mapId: string,
    @Req() req: RequestWithUser,
  ): Promise<TokenResponseDto[]> {
    return this.tokenService.getTokensByMap(mapId, req.user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '토큰 정보 업데이트 (이동 포함)' })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: '업데이트할 토큰 ID',
  })
  @ApiBody({ type: UpdateTokenDto })
  @ApiResponse({
    status: 200,
    description: '토큰 업데이트 성공',
    type: TokenResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: '토큰 조작 권한 없음',
    schema: {
      example: {
        message: TOKEN_ERROR_MESSAGES[TokenErrorCode.NO_MOVE_PERMISSION],
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: '토큰을 찾을 수 없음',
    schema: {
      example: {
        message: TOKEN_ERROR_MESSAGES[TokenErrorCode.TOKEN_NOT_FOUND],
      },
    },
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTokenDto,
    @Req() req: RequestWithUser,
  ): Promise<TokenResponseDto> {
    return this.tokenService.updateToken(id, dto, req.user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: '토큰 삭제' })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: '삭제할 토큰 ID',
  })
  @ApiResponse({ status: 204, description: '토큰 삭제 성공' })
  @ApiResponse({
    status: 403,
    description: '토큰 삭제 권한 없음',
    schema: {
      example: {
        message: TOKEN_ERROR_MESSAGES[TokenErrorCode.NO_MOVE_PERMISSION],
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: '토큰을 찾을 수 없음',
    schema: {
      example: {
        message: TOKEN_ERROR_MESSAGES[TokenErrorCode.TOKEN_NOT_FOUND],
      },
    },
  })
  async remove(
    @Param('id') id: string,
    @Req() req: RequestWithUser,
  ): Promise<void> {
    return this.tokenService.deleteToken(id, req.user.id);
  }
}
