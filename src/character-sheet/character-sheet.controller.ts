import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  Req,
  HttpStatus,
  HttpCode,
  ParseIntPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CharacterSheetService } from './character-sheet.service';
import { CreateCharacterSheetDto } from './dto/create-character-sheet.dto';
import { UpdateCharacterSheetDto } from './dto/update-character-sheet.dto';
import { CharacterSheetResponseDto } from './dto/character-sheet-response.dto';
import { RequestWithUser } from '@/auth/types/request-with-user.dto';

@ApiTags('Character Sheets')
@Controller('character-sheets')
@UseGuards(JwtAuthGuard)
export class CharacterSheetController {
  constructor(private readonly characterSheetService: CharacterSheetService) {}

  @ApiBearerAuth()
  @Post(':participantId')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '캐릭터 시트 생성',
    description:
      '새로운 캐릭터 시트를 생성합니다. (멱등성 보장: 이미 존재하면 409 반환)',
  })
  @ApiParam({
    name: 'participantId',
    description: '방 참가자 ID',
  })
  @ApiBody({ type: CreateCharacterSheetDto })
  @ApiCreatedResponse({
    description: '캐릭터 시트 생성 성공',
    type: CharacterSheetResponseDto,
  })
  @ApiBadRequestResponse({ description: '잘못된 요청 (유효성 검사 실패)' })
  @ApiConflictResponse({
    description: '이미 시트가 존재함 또는 타인의 시트 생성 시도',
  })
  @ApiNotFoundResponse({ description: '참가자를 찾을 수 없음' })
  async create(
    @Param('participantId', ParseIntPipe) participantId: number,
    @Body() createDto: CreateCharacterSheetDto,
    @Req() req: RequestWithUser,
  ) {
    const userId = req.user.id;
    const createdSheet = await this.characterSheetService.createCharacterSheet(
      participantId,
      createDto,
      userId,
    );
    return CharacterSheetResponseDto.fromEntity(createdSheet);
  }

  @ApiBearerAuth()
  @Get(':participantId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '캐릭터 시트 조회' })
  @ApiParam({
    name: 'participantId',
    description: '방 참가자 ID',
  })
  @ApiOkResponse({
    description: '캐릭터 시트 조회 성공',
    type: CharacterSheetResponseDto,
  })
  @ApiForbiddenResponse({
    description: '접근 권한 없음 (GM/OWNER/Public 아님)',
  })
  @ApiNotFoundResponse({ description: '캐릭터 시트를 찾을 수 없음' })
  async findOne(
    @Param('participantId', ParseIntPipe) participantId: number,
    @Req() req: RequestWithUser,
  ) {
    const userId = req.user.id;
    const foundSheet = await this.characterSheetService.getCharacterSheet(
      participantId,
      userId,
    );
    return CharacterSheetResponseDto.fromEntity(foundSheet);
  }

  @ApiBearerAuth()
  @Patch(':participantId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '캐릭터 시트 업데이트',
    description:
      '캐릭터 시트를 업데이트합니다. (멱등성 보장: 항상 최신 데이터로 덮어씀)',
  })
  @ApiParam({
    name: 'participantId',
    description: '방 참가자 ID',
  })
  @ApiBody({ type: UpdateCharacterSheetDto })
  @ApiOkResponse({
    description: '캐릭터 시트 업데이트 성공',
    type: CharacterSheetResponseDto,
  })
  @ApiForbiddenResponse({
    description: '수정 권한 없음 또는 isPublic은 GM만 변경 가능',
  })
  @ApiNotFoundResponse({ description: '캐릭터 시트를 찾을 수 없음' })
  async update(
    @Param('participantId', ParseIntPipe) participantId: number,
    @Body() updateDto: UpdateCharacterSheetDto,
    @Req() req: RequestWithUser,
  ) {
    const userId = req.user.id;
    const updatedSheet = await this.characterSheetService.updateCharacterSheet(
      participantId,
      userId,
      updateDto,
    );
    return CharacterSheetResponseDto.fromEntity(updatedSheet);
  }
}
