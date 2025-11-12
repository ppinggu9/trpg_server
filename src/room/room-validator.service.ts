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

  async validateRoomTransfer(
    room: Room,
    currentUserId: number,
    newCreatorId: number,
  ) {
    this.validateRoomCreator(room, currentUserId);

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

  async validateRoleChange(
    room: Room,
    currentUserId: number,
    targetUserId: number,
    newRole: ParticipantRole,
  ) {
    if (!Object.values(ParticipantRole).includes(newRole)) {
      throw new BadRequestException(
        `${ROOM_ERRORS.INVALID_PARTICIPANT_ROLE} (입력값: ${newRole})`,
      );
    }

    this.validateRoomCreator(room, currentUserId);

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

  async validateRoomCreation(userId: number): Promise<void> {
    await this.validateSingleRoomParticipation(userId);
  }

  async validateRoomJoin(
    room: Room,
    userId: number,
    password: string,
  ): Promise<void> {
    await this.validateSingleRoomParticipation(userId);
    await this.validateRoomPassword(room, password);
    await this.validateRoomCapacity(room);
  }
}
