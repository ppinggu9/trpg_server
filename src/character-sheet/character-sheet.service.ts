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
import { ParticipantRole } from '@/common/enums/participant-role.enum';

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
    const existingSheet = await this.characterSheetRepository.findOne({
      where: { participant: { id: participantId } },
    });

    if (existingSheet) {
      throw new ConflictException(CHARACTER_SHEET_ERRORS.SHEET_ALREADY_EXISTS);
    }

    const participant =
      await this.roomParticipantService.getParticipantById(participantId);
    if (!participant) {
      throw new NotFoundException(CHARACTER_SHEET_ERRORS.PARTICIPANT_NOT_FOUND);
    }

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

  async getCharacterSheetsByRoom(
    roomId: string,
    requesterUserId: number,
  ): Promise<CharacterSheet[]> {
    // 1. 요청자가 해당 방에 참여하고 있는지 확인
    const requesterParticipant =
      await this.roomParticipantService.getParticipantByUserIdAndRoomId(
        requesterUserId,
        roomId,
      );
    if (!requesterParticipant) {
      throw new ForbiddenException(CHARACTER_SHEET_ERRORS.NO_READ_PERMISSION);
    }

    // 2. 방에 속한 모든 참여자의 캐릭터 시트 조회
    const sheets = await this.characterSheetRepository
      .createQueryBuilder('sheet')
      .leftJoinAndSelect('sheet.participant', 'participant')
      .leftJoinAndSelect('participant.user', 'user')
      .leftJoinAndSelect('participant.room', 'room')
      .where('room.id = :roomId', { roomId })
      .getMany();

    // 3. 권한에 따른 필터링 적용
    const isRequesterGM = requesterParticipant.role === ParticipantRole.GM;
    const filteredSheets = sheets.filter((sheet) => {
      const isOwner = sheet.participant.user.id === requesterUserId;
      return isRequesterGM || isOwner || sheet.isPublic;
    });

    return filteredSheets;
  }

  private async findSheetWithRelations(sheetId: number) {
    return await this.characterSheetRepository.findOne({
      where: { id: sheetId },
      relations: ['participant', 'participant.user'],
    });
  }
}
