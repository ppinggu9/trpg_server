// src/charactersheet/services/character-sheet-validator.service.ts

import { Injectable, ForbiddenException } from '@nestjs/common';
import { RoomParticipantService } from '@/room/room-participant.service';
import { ParticipantRole } from '@/common/enums/participant-role.enum';
import { InjectRepository } from '@nestjs/typeorm';
import { CharacterSheet } from './entities/character-sheet.entity';
import { Repository } from 'typeorm';
import { CHARACTER_SHEET_ERRORS } from './constant/character-sheet.constants';

@Injectable()
export class CharacterSheetValidatorService {
  constructor(
    @InjectRepository(CharacterSheet)
    private characterSheetRepository: Repository<CharacterSheet>,
    private roomParticipantService: RoomParticipantService,
  ) {}

  async validateReadAccess(
    sheet: CharacterSheet,
    requesterUserId: number,
  ): Promise<void> {
    const isRequesterOwner = sheet.participant.user.id === requesterUserId;
    const requesterParticipant =
      await this.roomParticipantService.getParticipantByUserId(requesterUserId);
    const isRequesterGM = requesterParticipant?.role === ParticipantRole.GM;

    if (isRequesterGM || isRequesterOwner || sheet.isPublic) {
      return;
    }

    throw new ForbiddenException(CHARACTER_SHEET_ERRORS.NO_READ_PERMISSION);
  }

  async validateWriteAccess(
    sheet: CharacterSheet,
    requesterUserId: number,
  ): Promise<void> {
    const isRequesterOwner = sheet.participant.user.id === requesterUserId;

    // [핵심] 요청자가 해당 방의 GM인지 확인
    const requesterParticipant =
      await this.roomParticipantService.getParticipantByUserId(requesterUserId);
    const isRequesterGM = requesterParticipant?.role === ParticipantRole.GM;

    if (isRequesterGM || isRequesterOwner) {
      return;
    }

    throw new ForbiddenException(CHARACTER_SHEET_ERRORS.NO_WRITE_PERMISSION);
  }

  async validatePublicUpdateAccess(
    sheet: CharacterSheet,
    requesterUserId: number,
  ): Promise<void> {
    const requesterParticipant =
      await this.roomParticipantService.getParticipantByUserId(requesterUserId);
    const isRequesterGM = requesterParticipant?.role === ParticipantRole.GM;

    if (isRequesterGM) {
      return;
    }

    throw new ForbiddenException(
      CHARACTER_SHEET_ERRORS.PUBLIC_UPDATE_RESTRICTED,
    );
  }
}
