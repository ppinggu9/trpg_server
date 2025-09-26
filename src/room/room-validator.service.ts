import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { Room } from './entities/room.entity';
import { RoomParticipant } from './entities/room-participant.entity';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { RoomParticipantService } from './room-participant.service';
import { ParticipantRole } from '@/common/enums/participant-role.enum';
import { ROOM_ERRORS } from './constants/room.constants';

@Injectable()
export class RoomValidatorService {
  constructor(
    @InjectRepository(RoomParticipant)
    private readonly roomParticipantRepository: Repository<RoomParticipant>,
    private readonly roomParticipantService: RoomParticipantService,
  ) {}

  //방장 권한 확인
  validateRoomCreator(room: Room, userId: number): void {
    if (!room.creator || room.creator.id !== userId) {
      throw new ForbiddenException({
        message: ROOM_ERRORS.NOT_ROOM_CREATOR,
        details: {
          roomId: room.id,
          userId: userId,
        },
      });
    }
  }

  // 방장 위임
  async validateRoomTransfer(
    room: Room,
    currentUserId: number,
    newCreatorId: number,
  ) {
    // 방 존재 여부 (호출 전에 검증됨)

    // 기존 방장인지 확인
    this.validateRoomCreator(room, currentUserId);

    // 자기 자신에게 위임 방지
    if (newCreatorId === currentUserId) {
      throw new BadRequestException({
        message: ROOM_ERRORS.CANNOT_TRANSFER_TO_SELF,
        details: { roomId: room.id, currentUserId, newCreatorId },
      });
    }

    const participant = await this.roomParticipantService.getParticipant(
      room.id,
      newCreatorId,
    );
    if (!participant) {
      throw new BadRequestException({
        message: ROOM_ERRORS.TARGET_NOT_IN_ROOM,
        details: { roomId: room.id, userId: newCreatorId },
      });
    }
  }

  // 역할 설정
  async validateRoleChange(
    room: Room,
    currentUserId: number,
    targetUserId: number,
    newRole: ParticipantRole,
  ) {
    // newRole이 유효한 값인지 확인 (GM/PLAYER만 허용)
    if (!Object.values(ParticipantRole).includes(newRole)) {
      throw new BadRequestException(
        `${ROOM_ERRORS.INVALID_PARTICIPANT_ROLE} (입력값: ${newRole})`,
      );
    }

    // 방장인지 확인 (역할 변경 권한)
    this.validateRoomCreator(room, currentUserId);

    // 대상 사용자가 방에 참여 중인지 확인
    const participant = await this.roomParticipantService.getParticipant(
      room.id,
      targetUserId,
    );
    if (!participant) {
      throw new BadRequestException({
        message: ROOM_ERRORS.TARGET_NOT_IN_ROOM,
        details: { roomId: room.id, userId: targetUserId },
      });
    }
  }

  // 단일 방 참여 제한 검증
  async validateSingleRoomParticipation(userId: number): Promise<void> {
    const activeCount = await this.roomParticipantRepository.count({
      where: {
        user: { id: userId },
      },
    });
    if (activeCount > 0) {
      throw new ConflictException({
        message: ROOM_ERRORS.ALREADY_IN_ROOM,
        details: { userId },
      });
    }
  }

  // 방 비밀번호 검증
  async validateRoomPassword(room: Room, password: string): Promise<void> {
    if (!room.password) {
      throw new BadRequestException({
        message: ROOM_ERRORS.PASSWORD_REQUIRED,
        details: { roomId: room.id },
      });
    }

    if (!password) {
      throw new BadRequestException({
        message: ROOM_ERRORS.PASSWORD_REQUIRED,
        details: { roomId: room.id },
      });
    }

    const isValid = await bcrypt.compare(password, room.password);
    if (!isValid) {
      throw new BadRequestException({
        message: ROOM_ERRORS.PASSWORD_MISMATCH,
        details: { roomId: room.id },
      });
    }
  }

  // 인원 수 제한 검증
  async validateRoomCapacity(room: Room): Promise<void> {
    const activeCount = await this.roomParticipantRepository.count({
      where: { room: { id: room.id } },
    });

    if (activeCount >= room.maxParticipants) {
      throw new BadRequestException({
        message: ROOM_ERRORS.ROOM_FULL,
      });
    }
  }

  // 방 생성 전 검증
  async validateRoomCreation(userId: number): Promise<void> {
    await this.validateSingleRoomParticipation(userId);
  }

  // 방 참가 전 검증
  async validateRoomJoin(
    room: Room,
    userId: number,
    password: string,
  ): Promise<void> {
    // 이 시점에서 room은 활성화된 방임이 보장됨
    await this.validateSingleRoomParticipation(userId);
    await this.validateRoomPassword(room, password);
    await this.validateRoomCapacity(room);
  }
}
