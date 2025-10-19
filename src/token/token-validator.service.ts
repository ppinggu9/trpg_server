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
  // 일반 토큰(이미지 토큰) 및 NPC 토큰은 GM만 조작 가능합니다. ispublic 여부는 X
  // 플레이어는 자신의 캐릭터 시트에 연결된 토큰만 이동/삭제할 수 있습니다.

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

    // GM은 모든 토큰 생성 가능
    if (isGM) return;

    // 플레이어는 오직 자신의 캐릭터 시트 토큰만 생성 가능
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
      // NPC 또는 일반 토큰은 생성 불가
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

    // 캐릭터 시트 토큰: 소유자만 조작 가능
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

    // NPC 토큰 또는 일반 토큰: GM만 조작 가능
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
