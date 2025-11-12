import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DeleteResult, Repository } from 'typeorm';
import { Room } from './entities/room.entity';
import { User } from '@/users/entities/user.entity';
import { RoomParticipant } from './entities/room-participant.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { RoomParticipantDto } from './dto/room-participant.dto';
import { ParticipantRole } from '@/common/enums/participant-role.enum';
import { ROOM_PARTICIPANT_ERRORS } from './constants/room.constants';

@Injectable()
export class RoomParticipantService {
  constructor(
    @InjectRepository(RoomParticipant)
    private readonly roomParticipantRepository: Repository<RoomParticipant>,
  ) {}

  async addParticipant(
    room: Room,
    user: User,
    role: ParticipantRole = ParticipantRole.PLAYER,
  ): Promise<void> {
    const activeParticipation = await this.roomParticipantRepository.findOne({
      where: {
        room: { id: room.id },
        user: { id: user.id },
      },
    });

    if (activeParticipation) {
      throw new BadRequestException({
        message: ROOM_PARTICIPANT_ERRORS.ALREADY_PARTICIPATING,
        details: { roomId: room.id, userId: user.id },
      });
    }

    const participant = this.roomParticipantRepository.create({
      room,
      user,
      role,
    });
    await this.roomParticipantRepository.save(participant);
  }

  async leaveRoom(userId: number, roomId: string): Promise<void> {
    const participation = await this.roomParticipantRepository.findOne({
      where: { user: { id: userId }, room: { id: roomId } },
      withDeleted: true,
    });

    if (!participation || participation.leftAt) {
      return;
    }

    await this.roomParticipantRepository.softDelete(participation.id);
  }

  async leaveAllRoomsByUserId(userId: number): Promise<DeleteResult> {
    const participations = await this.roomParticipantRepository.find({
      where: { user: { id: userId } },
    });

    if (participations.length === 0) {
      return { raw: [], affected: 0 };
    }

    const idsToSoftDelete = participations.map((p) => p.id);
    const deleteResult: DeleteResult =
      await this.roomParticipantRepository.softDelete(idsToSoftDelete);
    return deleteResult;
  }

  async leaveAllUsersFromRoom(roomId: string): Promise<void> {
    const participations = await this.roomParticipantRepository.find({
      where: { room: { id: roomId } },
    });

    if (participations.length === 0) {
      return;
    }

    const participationIds = participations.map((p) => p.id);
    await this.roomParticipantRepository.softDelete(participationIds);
  }

  async getActiveParticipants(roomId: string): Promise<RoomParticipantDto[]> {
    const participants = await this.roomParticipantRepository.find({
      where: { room: { id: roomId } },
      relations: {
        user: true,
      },
      select: {
        user: {
          id: true,
          nickname: true,
          name: true,
        },
      },
    });

    return participants.map((p) => ({
      id: p.user.id,
      name: p.user.name ?? '탈퇴한 사용자',
      nickname: p.user.nickname,
      role: p.role,
    }));
  }

  async getActiveParticipantsCount(roomId: string): Promise<number> {
    return this.roomParticipantRepository.count({
      where: { room: { id: roomId } },
    });
  }

  async getParticipant(
    roomId: string,
    userId: number,
  ): Promise<RoomParticipant | null> {
    return this.roomParticipantRepository.findOne({
      where: { room: { id: roomId }, user: { id: userId } },
    });
  }

  async updateParticipantRole(
    participantId: number,
    newRole: ParticipantRole,
  ): Promise<void> {
    if (!Object.values(ParticipantRole).includes(newRole)) {
      throw new BadRequestException({
        message: ROOM_PARTICIPANT_ERRORS.INVALID_PARTICIPANT_ROLE,
        details: { participantId, newRole },
      });
    }
    const participant = await this.roomParticipantRepository.findOne({
      where: { id: participantId },
    });

    if (!participant) {
      throw new NotFoundException({
        message: ROOM_PARTICIPANT_ERRORS.PARTICIPANT_NOT_FOUND,
        details: { participantId },
      });
    }

    participant.role = newRole;
    await this.roomParticipantRepository.save(participant);
  }

  async getParticipantById(
    participantId: number,
  ): Promise<RoomParticipant | null> {
    return this.roomParticipantRepository
      .createQueryBuilder('participant')
      .leftJoinAndSelect('participant.user', 'user')
      .leftJoinAndSelect('participant.room', 'room')
      .where('participant.id = :id', { id: participantId })
      .getOne();
  }
  async getParticipantByUserId(
    userId: number,
  ): Promise<RoomParticipant | null> {
    return this.roomParticipantRepository.findOne({
      where: { user: { id: userId } },
      relations: ['user', 'room'],
    });
  }

  async getParticipantByUserIdAndRoomId(
    userId: number,
    roomId: string,
  ): Promise<RoomParticipant | null> {
    return this.roomParticipantRepository.findOne({
      where: {
        user: { id: userId },
        room: { id: roomId },
      },
      relations: ['user', 'room'],
    });
  }
}
