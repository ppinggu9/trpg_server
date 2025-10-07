import { Injectable, ForbiddenException } from '@nestjs/common';
import { RoomParticipantService } from '@/room/room-participant.service';
import { ParticipantRole } from '@/common/enums/participant-role.enum';
import { NPC_ERRORS } from './constants/npc.constants';
import { RoomParticipant } from '@/room/entities/room-participant.entity';
import { Npc } from './entities/npc.entity';
@Injectable()
export class NpcValidatorService {
  constructor(private roomParticipantService: RoomParticipantService) {}

  async validateGmAccess(roomId: string, userId: number): Promise<void> {
    const participant = await this.getParticipantOrThrow(roomId, userId);
    if (participant.role !== ParticipantRole.GM) {
      throw new ForbiddenException(NPC_ERRORS.GM_REQUIRED);
    }
  }

  async validateAndGetGmParticipant(
    roomId: string,
    userId: number,
  ): Promise<RoomParticipant> {
    const participant = await this.getParticipantOrThrow(roomId, userId);
    if (participant.role !== ParticipantRole.GM) {
      throw new ForbiddenException(NPC_ERRORS.GM_REQUIRED);
    }
    return participant;
  }

  async validateReadAccess(
    npc: Npc,
    participant: RoomParticipant,
  ): Promise<void> {
    if (participant.role !== ParticipantRole.GM && !npc.isPublic) {
      throw new ForbiddenException(NPC_ERRORS.READ_FORBIDDEN);
    }
  }

  private async getParticipantOrThrow(
    roomId: string,
    userId: number,
  ): Promise<RoomParticipant> {
    const participant =
      await this.roomParticipantService.getParticipantByUserIdAndRoomId(
        userId,
        roomId,
      );
    if (!participant) {
      throw new ForbiddenException(NPC_ERRORS.PARTICIPANT_NOT_IN_ROOM);
    }
    return participant;
  }

  async validateParticipantAccess(
    roomId: string,
    userId: number,
  ): Promise<RoomParticipant> {
    return this.getParticipantOrThrow(roomId, userId);
  }
}
