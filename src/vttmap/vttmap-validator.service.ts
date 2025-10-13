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

  // 참여자 검증 (조회/읽기 권한 전제)
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

  // GM 전용 작업 검증
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

  // 참여자가 특정 맵을 조회할 수 있는지 (현재는 모두 공개 → 향후 isPublic 추가 시 확장)
  async validateReadAccessToMap(
    vttMapId: string,
    userId: number,
  ): Promise<VttMap> {
    const vttMap = await this.validateVttMapExists(vttMapId);
    await this.validateParticipantAccess(vttMap.roomId, userId);
    return vttMap;
  }
}
