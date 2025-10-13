import { RoomParticipantService } from '@/room/room-participant.service';
import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { VttMap } from './entities/vttmap.entity';
import { Repository } from 'typeorm';
import { ParticipantRole } from '@/common/enums/participant-role.enum';
import { RoomParticipant } from '@/room/entities/room-participant.entity';
import { VTTMAP_ERRORS } from './constants/vttmap.constants';

@Injectable()
export class VttMapValidatorService {
  constructor(
    private readonly roomParticipantService: RoomParticipantService,
    @InjectRepository(VttMap)
    private readonly vttMapRepository: Repository<VttMap>,
  ) {}

  async validateGmAccess(roomId: string, userId: number): Promise<void> {
    const participant = await this.getParticipantOrThrow(roomId, userId);
    if (participant.role !== ParticipantRole.GM) {
      throw new ForbiddenException(VTTMAP_ERRORS.NOT_ROOM_CREATOR);
    }
  }

  async validateNoExistingVttMap(roomId: string): Promise<void> {
    const mapExists = await this.vttMapRepository.exist({
      where: { room: { id: roomId } },
    });
    if (mapExists) {
      throw new ForbiddenException(VTTMAP_ERRORS.ALREADY_EXISTS);
    }
  }

  async validateVttMapExists(roomId: string): Promise<void> {
    const mapExists = await this.vttMapRepository.exist({
      where: { room: { id: roomId } },
    });
    if (!mapExists) {
      throw new ForbiddenException(VTTMAP_ERRORS.NOT_FOUND);
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
      throw new ForbiddenException(VTTMAP_ERRORS.PARTICIPANT_NOT_IN_ROOM);
    }
    return participant;
  }
}
