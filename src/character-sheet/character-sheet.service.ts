// src/charactersheet/services/character-sheet.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoomParticipantService } from '@/room/room-participant.service';
import { CharacterSheet } from './entities/character-sheet.entity';
import { CreateCharacterSheetDto } from './dto/create-character-sheet.dto';
import { UpdateCharacterSheetDto } from './dto/update-character-sheet.dto';
import { CHARACTER_SHEET_ERRORS } from './constant/character-sheet.constants';
import { CharacterSheetValidatorService } from './character-sheet-validator.service';
import { S3Service } from '@/s3/s3.service';
import { nanoid } from 'nanoid';
import { validateImageUpload } from '@/common/utils/validate-image-upload';

@Injectable()
export class CharacterSheetService {
  constructor(
    @InjectRepository(CharacterSheet)
    private readonly characterSheetRepository: Repository<CharacterSheet>,
    private readonly roomParticipantService: RoomParticipantService,
    private readonly validatorService: CharacterSheetValidatorService,
    private readonly s3service: S3Service,
  ) {}

  async createCharacterSheet(
    participantId: number,
    createDto: CreateCharacterSheetDto,
    requesterUserId: number,
  ) {
    // soft삭제는 남겨놓긴했지만 시나리오상 캐릭터시트는 삭제를 지원하면 안된다.
    const existingSheet = await this.characterSheetRepository.findOne({
      where: { participant: { id: participantId } },
    });

    // 존재확인
    if (existingSheet) {
      throw new ConflictException(CHARACTER_SHEET_ERRORS.SHEET_ALREADY_EXISTS);
    }

    // 참여자 확인
    const participant =
      await this.roomParticipantService.getParticipantById(participantId);
    if (!participant) {
      throw new NotFoundException(CHARACTER_SHEET_ERRORS.PARTICIPANT_NOT_FOUND);
    }

    // 일치여부 확인
    if (participant.user.id !== requesterUserId) {
      throw new ForbiddenException(CHARACTER_SHEET_ERRORS.OWNERSHIP_REQUIRED);
    }

    const newSheet = this.characterSheetRepository.create({
      data: createDto.data,
      trpgType: participant.room.system,
      isPublic: createDto.isPublic,
      participant,
    });

    return this.characterSheetRepository.save(newSheet);
  }

  async getCharacterSheet(participantId: number, requesterUserId: number) {
    const sheet = await this.characterSheetRepository.findOne({
      where: { participant: { id: participantId } },
      relations: ['participant', 'participant.user'],
    });
    if (!sheet) {
      throw new NotFoundException(CHARACTER_SHEET_ERRORS.SHEET_NOT_FOUND);
    }

    await this.validatorService.validateReadAccess(sheet, requesterUserId);

    return sheet;
  }

  async updateCharacterSheet(
    participantId: number,
    requesterUserId: number,
    updateDto: UpdateCharacterSheetDto,
  ) {
    const sheet = await this.characterSheetRepository.findOne({
      where: { participant: { id: participantId } },
      relations: ['participant', 'participant.user'],
    });
    if (!sheet) {
      throw new NotFoundException(CHARACTER_SHEET_ERRORS.SHEET_NOT_FOUND);
    }

    await this.validatorService.validateWriteAccess(sheet, requesterUserId);
    if (updateDto.isPublic !== undefined) {
      await this.validatorService.validatePublicUpdateAccess(
        sheet,
        requesterUserId,
      );
      sheet.isPublic = updateDto.isPublic;
    }

    sheet.data = updateDto.data;
    return await this.characterSheetRepository.save(sheet);
  }

  async getPresignedUrlForCharacterSheet(
    participantId: number,
    fileName: string,
    contentType: string,
    requesterUserId: number,
  ) {
    await this.validatorService.validateUploadAccess(
      participantId,
      requesterUserId,
    );

    const normalizedExt = validateImageUpload(fileName, contentType);

    const targetParticipant =
      await this.roomParticipantService.getParticipantById(participantId);
    if (!targetParticipant) {
      throw new NotFoundException(CHARACTER_SHEET_ERRORS.PARTICIPANT_NOT_FOUND);
    }
    const roomId = targetParticipant.room.id;

    const key = `uploads/characters/${roomId}/${participantId}/${nanoid()}.${normalizedExt}`;

    const presignedUrl = await this.s3service.getPresignedPutUrl(
      key,
      contentType,
    );
    const publicUrl = this.s3service.getCloudFrontUrl(key);

    return { presignedUrl, publicUrl, key };
  }

  // token에서 쓴다
  async getCharacterSheetById(sheetId: number, requesterUserId: number) {
    const sheet = await this.findSheetWithRelations(sheetId);
    if (!sheet) {
      throw new NotFoundException(CHARACTER_SHEET_ERRORS.SHEET_NOT_FOUND);
    }
    await this.validatorService.validateReadAccess(sheet, requesterUserId);
    return sheet;
  }

  async isOwner(sheetId: number, userId: number): Promise<boolean> {
    const sheet = await this.findSheetWithRelations(sheetId);
    if (!sheet) {
      return false;
    }
    return sheet.participant?.user?.id === userId;
  }

  private async findSheetWithRelations(sheetId: number) {
    return await this.characterSheetRepository.findOne({
      where: { id: sheetId },
      relations: ['participant', 'participant.user'],
    });
  }
}
