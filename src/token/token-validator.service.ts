import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Token } from './entities/token.entity';
import { Repository } from 'typeorm';
import { RoomParticipantService } from '@/room/room-participant.service';
import { CharacterSheetService } from '@/character-sheet/character-sheet.service';
import {
  TOKEN_ERROR_MESSAGES,
  TokenErrorCode,
} from './constants/token.constants';
import { ParticipantRole } from '@/common/enums/participant-role.enum';
import { VttMapService } from '@/vttmap/vttmap.service';
import { CreateTokenDto } from './dto/create-token.dto';

@Injectable()
export class TokenValidatorService {
  constructor(
    @InjectRepository(Token)
    private readonly tokenRepository: Repository<Token>,
    private readonly vttMapService: VttMapService,
    private readonly roomParticipantService: RoomParticipantService,
    private readonly characterSheetService: CharacterSheetService,
  ) {}

  async validateMapAccess(mapId: string, userId: number) {
    const map = await this.vttMapService.getMapWithRoom(mapId);

    const participant =
      await this.roomParticipantService.getParticipantByUserIdAndRoomId(
        userId,
        map.room.id,
      );
    if (!participant) {
      throw new ForbiddenException(
        TOKEN_ERROR_MESSAGES[TokenErrorCode.NOT_IN_ROOM],
      );
    }
    return { participant, map };
  }

  async validateCreateAccess(
    mapId: string,
    dto: CreateTokenDto,
    userId: number,
  ) {
    const { participant } = await this.validateMapAccess(mapId, userId);
    const isGM = participant.role === ParticipantRole.GM;

    if (isGM) return;

    if (dto.characterSheetId != null) {
      const isOwner = await this.characterSheetService.isOwner(
        dto.characterSheetId,
        userId,
      );
      if (!isOwner) {
        throw new ForbiddenException(
          TOKEN_ERROR_MESSAGES[TokenErrorCode.NO_MOVE_PERMISSION],
        );
      }
    } else {
      throw new ForbiddenException(
        '플레이어는 자신의 캐릭터 시트 토큰만 생성할 수 있습니다.',
      );
    }
  }

  async validateMoveOrDeleteAccess(
    tokenId: string,
    userId: number,
  ): Promise<Token> {
    const token = await this.tokenRepository.findOne({
      where: { id: tokenId },
      relations: ['map', 'map.room'],
    });
    if (!token) {
      throw new NotFoundException(
        TOKEN_ERROR_MESSAGES[TokenErrorCode.TOKEN_NOT_FOUND],
      );
    }

    const { participant } = await this.validateMapAccess(token.mapId, userId);
    const isGM = participant.role === ParticipantRole.GM;

    if (isGM) return token;

    if (token.characterSheetId != null) {
      const canEdit = await this.characterSheetService.isOwner(
        token.characterSheetId,
        userId,
      );
      if (!canEdit) {
        throw new ForbiddenException(
          TOKEN_ERROR_MESSAGES[TokenErrorCode.NO_MOVE_PERMISSION],
        );
      }
      return token;
    }

    throw new ForbiddenException(
      TOKEN_ERROR_MESSAGES[TokenErrorCode.NO_MOVE_PERMISSION],
    );
  }

  validateOwnershipRelation(dto: {
    characterSheetId?: number;
    npcId?: number;
  }) {
    const hasChar = dto.characterSheetId != null;
    const hasNpc = dto.npcId != null;
    if (hasChar && hasNpc) {
      throw new BadRequestException(
        TOKEN_ERROR_MESSAGES[TokenErrorCode.BOTH_SHEET_AND_NPC],
      );
    }
  }
}
