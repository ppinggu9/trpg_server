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
  ApiResponse,
} from '@nestjs/swagger';
import { CharacterSheetService } from './character-sheet.service';
import { CreateCharacterSheetDto } from './dto/create-character-sheet.dto';
import { UpdateCharacterSheetDto } from './dto/update-character-sheet.dto';
import { CharacterSheetResponseDto } from './dto/character-sheet-response.dto';
import { RequestWithUser } from '@/auth/types/request-with-user.dto';
import { CreatePresignedUrlDto } from '@/common/dto/create-presigned-url.dto';
import { PresignedUrlResponseDto } from '@/common/dto/presigned-url-response.dto';
import { CHARACTER_SHEET_ERRORS } from './constant/character-sheet.constants';

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
      '자신의 캐릭터 시트를 생성하거나, GM이 방 내 다른 참여자의 시트를 생성할 수 있습니다.\n' +
      '- 일반 참여자: 자신의 participantId만 사용 가능\n' +
      '- GM: 모든 participantId 사용 가능\n' +
      '- `data.imageUrl` 필드를 통해 캐릭터 이미지 URL 설정 가능\n' +
      '멱등성 보장: 이미 존재하면 409 반환',
  })
  @ApiParam({
    name: 'participantId',
    type: 'number',
    description: '방 참가자 ID',
  })
  @ApiBody({ type: CreateCharacterSheetDto })
  @ApiCreatedResponse({
    description: '캐릭터 시트 생성 성공',
    type: CharacterSheetResponseDto,
  })
  @ApiBadRequestResponse({
    description: '잘못된 요청 (유효성 검사 실패) 또는 data가 객체 아님',
  })
  @ApiConflictResponse({
    description: CHARACTER_SHEET_ERRORS.SHEET_ALREADY_EXISTS,
  })
  @ApiForbiddenResponse({
    description: CHARACTER_SHEET_ERRORS.OWNERSHIP_REQUIRED,
  })
  @ApiNotFoundResponse({
    description: CHARACTER_SHEET_ERRORS.PARTICIPANT_NOT_FOUND,
  })
  async create(
    @Param('participantId', ParseIntPipe) participantId: number,
    @Body() createDto: CreateCharacterSheetDto,
    @Req() req: RequestWithUser,
  ) {
    const createdSheet = await this.characterSheetService.createCharacterSheet(
      participantId,
      createDto,
      req.user.id,
    );
    // console.log(
    //   `[DEBUG CharacterSheet.create] Created sheet for participant ${participantId}, requester ${req.user.id}:`,
    //   {
    //     id: createdSheet.id,
    //     participantId: createdSheet.participant?.id,
    //     ownerId: createdSheet.participant?.user?.id,
    //     isPublic: createdSheet.isPublic,
    //     trpgType: createdSheet.trpgType,
    //   },
    // );
    return CharacterSheetResponseDto.fromEntity(createdSheet);
  }

  @Post(':participantId/presigned-url')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '캐릭터 시트용 이미지 업로드 Presigned URL 발급',
    description:
      '캐릭터 시트에 사용할 이미지(아바타 등)를 업로드하기 위한 Presigned URL을 발급합니다. ' +
      '1. 이 엔드포인트로 `presignedUrl`과 `publicUrl`을 받습니다.\n' +
      '2. 클라이언트가 `presignedUrl`로 S3에 이미지 PUT 요청\n' +
      '3. 성공 시, **반드시 `publicUrl`을 캐릭터시트의 `data.imageUrl` 필드에 저장**하세요.\n' +
      '※ `data`는 JSONB 필드로, 동적으로 모든 TRPG 데이터를 저장할 수 있습니다.',
  })
  @ApiParam({
    name: 'participantId',
    type: 'number',
    description: '방 참가자 ID (자신의 참가자 ID 또는 GM 권한 필요)',
  })
  @ApiBody({ type: CreatePresignedUrlDto })
  @ApiResponse({
    status: 201,
    description: 'Presigned URL이 성공적으로 발급되었습니다.',
    type: PresignedUrlResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      '다음 중 하나의 이유로 실패:\n' +
      '- 지원하지 않는 MIME 타입 (허용: image/jpeg, image/png, image/webp)\n' +
      '- 지원하지 않는 파일 확장자 (.jpg, .jpeg, .png, .webp만 허용)\n' +
      '- MIME 타입과 파일 확장자가 일치하지 않음',
  })
  @ApiForbiddenResponse({
    description: CHARACTER_SHEET_ERRORS.NO_WRITE_PERMISSION,
  })
  @ApiNotFoundResponse({
    description: CHARACTER_SHEET_ERRORS.PARTICIPANT_NOT_FOUND,
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
  @ApiOperation({
    summary: '캐릭터 시트 조회',
    description:
      '다음 조건 중 하나를 만족하면 조회 가능:\n' +
      '- 시트 소유자 (ownerId와 요청자 ID 일치)\n' +
      '- 방의 GM\n' +
      '- 시트가 공개 상태 (isPublic: true)\n' +
      '응답에는 `ownerId`가 포함되어, 클라이언트에서 권한 기반 UI 표시 가능.',
  })
  @ApiParam({
    name: 'participantId',
    type: 'number',
    description: '조회할 캐릭터 시트의 방 참가자 ID',
  })
  @ApiOkResponse({
    description: '캐릭터 시트 조회 성공',
    type: CharacterSheetResponseDto,
  })
  @ApiForbiddenResponse({
    description: CHARACTER_SHEET_ERRORS.NO_READ_PERMISSION,
  })
  @ApiNotFoundResponse({
    description: CHARACTER_SHEET_ERRORS.SHEET_NOT_FOUND,
  })
  async findOne(
    @Param('participantId', ParseIntPipe) participantId: number,
    @Req() req: RequestWithUser,
  ) {
    const foundSheet = await this.characterSheetService.getCharacterSheet(
      participantId,
      req.user.id,
    );
    // console.log(
    //   `[DEBUG CharacterSheet.findOne] Loaded sheet for participant ${participantId}, requester ${req.user.id}:`,
    //   {
    //     id: foundSheet.id,
    //     participantId: foundSheet.participant?.id,
    //     ownerId: foundSheet.participant?.user?.id,
    //     isPublic: foundSheet.isPublic,
    //     trpgType: foundSheet.trpgType,
    //   },
    // );
    return CharacterSheetResponseDto.fromEntity(foundSheet);
  }

  @Patch(':participantId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '캐릭터 시트 업데이트',
    description:
      '소유자 또는 GM만 시트를 수정할 수 있습니다.\n' +
      '- `data` 필드: 소유자와 GM 모두 수정 가능 (이미지 포함)\n' +
      '- `isPublic` 필드: **오직 GM만** 수정 가능\n' +
      '예: `data.imageUrl`을 업데이트하여 캐릭터 아바타 변경 가능.',
  })
  @ApiParam({
    name: 'participantId',
    type: 'number',
    description: '수정할 캐릭터 시트의 방 참가자 ID',
  })
  @ApiBody({ type: UpdateCharacterSheetDto })
  @ApiOkResponse({
    description: '캐릭터 시트 업데이트 성공',
    type: CharacterSheetResponseDto,
  })
  @ApiForbiddenResponse({
    description: CHARACTER_SHEET_ERRORS.NO_WRITE_PERMISSION,
  })
  @ApiNotFoundResponse({
    description: CHARACTER_SHEET_ERRORS.SHEET_NOT_FOUND,
  })
  async update(
    @Param('participantId', ParseIntPipe) participantId: number,
    @Body() updateDto: UpdateCharacterSheetDto,
    @Req() req: RequestWithUser,
  ) {
    const updatedSheet = await this.characterSheetService.updateCharacterSheet(
      participantId,
      req.user.id,
      updateDto,
    );
    // console.log(
    //   `[DEBUG CharacterSheet.update] Updated sheet for participant ${participantId}, requester ${req.user.id}:`,
    //   {
    //     id: updatedSheet.id,
    //     participantId: updatedSheet.participant?.id,
    //     ownerId: updatedSheet.participant?.user?.id,
    //     isPublic: updatedSheet.isPublic,
    //     trpgType: updatedSheet.trpgType,
    //     // isPublic 변경 시도 여부도 확인 가능
    //     requestedIsPublic: updateDto.isPublic,
    //   },
    // );
    return CharacterSheetResponseDto.fromEntity(updatedSheet);
  }
}
