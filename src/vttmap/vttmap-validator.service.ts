import { RoomParticipantService } from '@/room/room-participant.service';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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

  async validateParticipantAccess(
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

  async validateGmAccess(roomId: string, userId: number): Promise<void> {
    const participant = await this.validateParticipantAccess(roomId, userId);
    if (participant.role !== ParticipantRole.GM) {
      throw new ForbiddenException(VTTMAP_ERRORS.NOT_ROOM_CREATOR);
    }
  }

  async validateVttMapExists(vttMapId: string): Promise<VttMap> {
    const vttMap = await this.vttMapRepository.findOne({
      where: { id: vttMapId },
      relations: ['room'],
    });
    if (!vttMap || !vttMap.roomId) {
      throw new NotFoundException(VTTMAP_ERRORS.NOT_FOUND);
    }
    return vttMap;
  }

  async validateGmAccessToMap(
    vttMapId: string,
    userId: number,
  ): Promise<VttMap> {
    const vttMap = await this.validateVttMapExists(vttMapId);
    await this.validateGmAccess(vttMap.roomId, userId);
    return vttMap;
  }

  async validateReadAccessToMap(
    vttMapId: string,
    userId: number,
  ): Promise<VttMap> {
    const vttMap = await this.validateVttMapExists(vttMapId);
    await this.validateParticipantAccess(vttMap.roomId, userId);
    return vttMap;
  }
}
