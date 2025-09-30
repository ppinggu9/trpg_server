// src/npc/services/npc.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoomService } from '@/room/room.service';
import { ParticipantRole } from '@/common/enums/participant-role.enum';
import { NPC_ERRORS } from './constants/npc.constants';
import { CreateNpcDto } from './dto/create-npc.dto';
import { UpdateNpcDto } from './dto/update-npc.dto';
import { Npc } from './entities/npc.entity';
import { RoomParticipantService } from '@/room/room-participant.service';

@Injectable()
export class NpcService {
  constructor(
    @InjectRepository(Npc)
    private readonly npcRepository: Repository<Npc>,
    private readonly roomParticipantService: RoomParticipantService,
    private readonly roomService: RoomService,
  ) {}

  private async validateGmAccess(
    roomId: string,
    userId: number,
  ): Promise<void> {
    const participant =
      await this.roomParticipantService.getParticipantByUserIdAndRoomId(
        userId,
        roomId,
      );
    if (!participant || participant.role !== ParticipantRole.GM) {
      throw new ForbiddenException(NPC_ERRORS.NO_PERMISSION);
    }
  }

  async createNpc(roomId: string, createDto: CreateNpcDto, userId: number) {
    await this.validateGmAccess(roomId, userId);

    const room = await this.roomService.getRoomById(roomId);
    if (!room) {
      throw new NotFoundException(NPC_ERRORS.ROOM_NOT_FOUND);
    }

    const npc = this.npcRepository.create({
      data: createDto.data,
      trpgType: room.system,
      isPublic: createDto.isPublic,
      room,
    });

    return this.npcRepository.save(npc);
  }

  async getNpc(npcId: number, userId: number) {
    const npc = await this.npcRepository.findOne({
      where: { id: npcId },
      relations: ['room'],
    });
    if (!npc) throw new NotFoundException(NPC_ERRORS.NOT_FOUND);

    // GM이면 무조건 접근 가능
    const participant =
      await this.roomParticipantService.getParticipantByUserIdAndRoomId(
        userId,
        npc.room.id,
      );
    const isGm = participant?.role === ParticipantRole.GM;

    if (!isGm && !npc.isPublic) {
      throw new ForbiddenException(NPC_ERRORS.NO_PERMISSION);
    }

    return npc;
  }

  async updateNpc(npcId: number, updateDto: UpdateNpcDto, userId: number) {
    const npc = await this.npcRepository.findOne({
      where: { id: npcId },
      relations: ['room'],
    });
    if (!npc) throw new NotFoundException(NPC_ERRORS.NOT_FOUND);

    await this.validateGmAccess(npc.room.id, userId);

    if (updateDto.isPublic !== undefined) {
      npc.isPublic = updateDto.isPublic;
    }
    npc.data = updateDto.data;

    return this.npcRepository.save(npc);
  }

  async deleteNpc(npcId: number, userId: number) {
    const npc = await this.npcRepository.findOne({
      where: { id: npcId },
      relations: ['room'],
    });
    if (!npc) throw new NotFoundException(NPC_ERRORS.NOT_FOUND);

    await this.validateGmAccess(npc.room.id, userId);

    await this.npcRepository.remove(npc);
    return { success: true };
  }

  async getNpcsByRoom(roomId: string, userId: number): Promise<Npc[]> {
    // 1. 방 존재 여부 확인
    const room = await this.roomService.getRoomById(roomId);
    if (!room) throw new NotFoundException(NPC_ERRORS.ROOM_NOT_FOUND);

    // 2. 사용자가 해당 방에 참여 중인지 확인
    const participant =
      await this.roomParticipantService.getParticipantByUserIdAndRoomId(
        userId,
        roomId,
      );
    if (!participant) {
      throw new ForbiddenException('방에 참여하지 않았습니다.');
    }

    // 3. GM 여부에 따라 필터링
    let query = this.npcRepository
      .createQueryBuilder('npc')
      .where('npc.room_id = :roomId', { roomId });

    if (participant.role !== ParticipantRole.GM) {
      query = query.andWhere('npc.isPublic = true');
    }

    return await query.getMany();
  }
}
