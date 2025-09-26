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
@Injectable()
export class CharacterSheetService {
  constructor(
    @InjectRepository(CharacterSheet)
    private characterSheetRepository: Repository<CharacterSheet>,
    private roomParticipantService: RoomParticipantService,
    private validatorService: CharacterSheetValidatorService,
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
}
