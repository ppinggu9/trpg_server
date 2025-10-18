// src/npc/services/npc.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NpcValidatorService } from './npc-validator.service';
import { Npc } from './entities/npc.entity';
import { CreateNpcDto } from './dto/create-npc.dto';
import { NPC_ERRORS } from './constants/npc.constants';
import { UpdateNpcDto } from './dto/update-npc.dto';
import { NpcType } from '@/common/enums/npc-type.enum';
import { ParticipantRole } from '@/common/enums/participant-role.enum';
import { S3Service } from '@/s3/s3.service';
import { PresignedUrlResponseDto } from '@/common/dto/presigned-url-response.dto';
import { validateImageUpload } from '@/common/utils/validate-image-upload';
import { nanoid } from 'nanoid';

@Injectable()
export class NpcService {
  constructor(
    @InjectRepository(Npc)
    private readonly npcRepository: Repository<Npc>,
    private readonly validatorService: NpcValidatorService,
    private readonly s3Service: S3Service,
  ) {}

  async createNpc(roomId: string, dto: CreateNpcDto, userId: number) {
    const participant = await this.validatorService.validateAndGetGmParticipant(
      roomId,
      userId,
    );

    const npc = this.npcRepository.create({
      data: dto.data,
      trpgType: participant.room.system,
      isPublic: dto.isPublic,
      type: dto.type,
      room: participant.room,
    });
    return this.npcRepository.save(npc);
  }
  // 아래에 중복된 코드를 묶은 함수이다.
  private async findNpcOrFail(npcId: number): Promise<Npc> {
    const npc = await this.npcRepository.findOne({ where: { id: npcId } });
    if (!npc || !npc.roomId) {
      throw new NotFoundException(NPC_ERRORS.NOT_FOUND);
    }
    return npc;
  }

  async getNpc(npcId: number, userId: number) {
    const npc = await this.findNpcOrFail(npcId);

    const participant = await this.validatorService.validateParticipantAccess(
      npc.roomId,
      userId,
    );
    await this.validatorService.validateReadAccess(npc, participant);
    return npc;
  }

  async updateNpc(npcId: number, dto: UpdateNpcDto, userId: number) {
    const npc = await this.findNpcOrFail(npcId);

    await this.validatorService.validateGmAccess(npc.roomId, userId);

    if (dto.isPublic !== undefined) npc.isPublic = dto.isPublic;
    if (dto.type !== undefined) npc.type = dto.type;
    npc.data = dto.data;
    return this.npcRepository.save(npc);
  }

  async deleteNpc(npcId: number, userId: number) {
    const npc = await this.findNpcOrFail(npcId);

    await this.validatorService.validateGmAccess(npc.roomId, userId);
    await this.npcRepository.softRemove(npc);
    return { success: true };
  }

  async getPresignedUrlForNpcImage(
    roomId: string,
    fileName: string,
    contentType: string,
    userId: number,
  ): Promise<PresignedUrlResponseDto> {
    await this.validatorService.validateGmAccess(roomId, userId);

    const normalizedExt = validateImageUpload(fileName, contentType);

    const key = `uploads/npcs/${roomId}/${nanoid()}.${normalizedExt}`;

    const presignedUrl = await this.s3Service.getPresignedPutUrl(
      key,
      contentType,
    );
    const publicUrl = this.s3Service.getCloudFrontUrl(key);

    return { presignedUrl, publicUrl, key };
  }

  async getNpcsByRoom(
    roomId: string,
    userId: number,
    type?: NpcType,
  ): Promise<Npc[]> {
    const participant = await this.validatorService.validateParticipantAccess(
      roomId,
      userId,
    );

    const where: any = { roomId };
    if (participant.role !== ParticipantRole.GM) {
      where.isPublic = true;
    }
    if (type !== undefined) {
      where.type = type;
    }

    return this.npcRepository.find({ where });
  }
}
