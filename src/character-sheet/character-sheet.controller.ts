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
import { CreatePresignedUrlDto } from '@/common/dto/create-presigned-url.dto';
import { PresignedUrlResponseDto } from '@/common/dto/presigned-url-response.dto';

@ApiTags('Character Sheets')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller('character-sheets')
export class CharacterSheetController {
  constructor(private readonly characterSheetService: CharacterSheetService) {}

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

  @Post(':participantId/presigned-url')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '캐릭터 시트용 이미지 업로드 Presigned URL 발급',
    description:
      '캐릭터 시트에 사용할 이미지(아바타 등)를 업로드하기 위한 Presigned URL을 발급합니다. ' +
      '반환된 `presignedUrl`로 클라이언트가 직접 S3에 PUT 요청 후, ' +
      '`publicUrl`을 캐릭터 시트의 `data` 필드에 저장하세요.',
  })
  @ApiParam({
    name: 'participantId',
    type: Number,
    description: '방 참가자 ID (자신의 참가자 ID 또는 GM 권한 필요)',
  })
  @ApiBody({ type: CreatePresignedUrlDto })
  @ApiOkResponse({
    description: 'Presigned URL 발급 성공',
    type: PresignedUrlResponseDto,
    content: {
      'application/json': {
        example: {
          presignedUrl:
            'https://your-bucket.s3.ap-northeast-2.amazonaws.com/uploads/...?X-Amz-Signature=abc123',
          publicUrl: 'https://d12345.cloudfront.net/uploads/abc123.png',
          key: 'uploads/characters/room-123/456/abc123.png',
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description:
      '다음 중 하나의 이유로 실패: \n' +
      '- 지원하지 않는 MIME 타입 (허용: image/jpeg, image/png, image/webp)\n' +
      '- 지원하지 않는 파일 확장자 (.jpg, .jpeg, .png, .webp만 허용)\n' +
      '- MIME 타입과 파일 확장자가 일치하지 않음',
  })
  @ApiForbiddenResponse({
    description:
      '해당 캐릭터 시트에 대한 업로드 권한 없음 (소유자 또는 GM만 가능)',
  })
  @ApiNotFoundResponse({
    description: '해당 participantId를 찾을 수 없음',
  })
  async getPresignedUrlForCharacterSheet(
    @Param('participantId', ParseIntPipe) participantId: number,
    @Body() body: CreatePresignedUrlDto,
    @Req() req: RequestWithUser,
  ): Promise<PresignedUrlResponseDto> {
    return this.characterSheetService.getPresignedUrlForCharacterSheet(
      participantId,
      body.fileName,
      body.contentType,
      req.user.id,
    );
  }

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
