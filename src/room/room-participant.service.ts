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

  // 방 참가 처리
  async addParticipant(
    room: Room,
    user: User,
    role: ParticipantRole = ParticipantRole.PLAYER,
  ): Promise<void> {
    // 현재 참여 중인지 확인 (leftAt이 null인 기록이 있는지)
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

  // 방 나가기 처리
  async leaveRoom(userId: number, roomId: string): Promise<void> {
    const participation = await this.roomParticipantRepository.findOne({
      where: { user: { id: userId }, room: { id: roomId } },
      withDeleted: true,
    });

    if (!participation || participation.leftAt) {
      return; // 멱등성 보장
    }

    await this.roomParticipantRepository.softDelete(participation.id);
  }

  // 해당 유저 모든 방 나가기, userService의 softdelete시 사용
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

  // 방이 삭제될 때 모든 참가자를 한 번에 나가게 처리
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

  // 참여자 목록 조회
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

  // 참여자수 확인
  async getActiveParticipantsCount(roomId: string): Promise<number> {
    return this.roomParticipantRepository.count({
      where: { room: { id: roomId } },
    });
  }

  // 참여자가 있는지
  async getParticipant(
    roomId: string,
    userId: number,
  ): Promise<RoomParticipant | null> {
    return this.roomParticipantRepository.findOne({
      where: { room: { id: roomId }, user: { id: userId } },
    });
  }

  // 참여자 역할 업데이트 메서드
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

  // 밑에 2개는 charactersheet에서 권한여부를 위해 사용
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
