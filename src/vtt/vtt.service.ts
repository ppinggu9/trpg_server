// src/vtt/vtt.service.ts
import { Injectable } from '@nestjs/common';
import { TokenValidatorService } from '@/token/token-validator.service';
import { TokenService } from '@/token/token.service';
import { VttMapService } from '@/vttmap/vttmap.service';
import { UpdateVttMapDto } from '@/vttmap/dto/update-vttmap.dto';
import { TokenResponseDto } from '@/token/dto/token-response.dto';
import { VttMapValidatorService } from '@/vttmap/vttmap-validator.service';

@Injectable()
export class VttService {
  constructor(
    private readonly validator: TokenValidatorService,
    private readonly tokenService: TokenService,
    private readonly vttMapService: VttMapService,
    private readonly vttMapValidatorService: VttMapValidatorService,
  ) {}

  async validateParticipantAccess(roomId: string, userId: number) {
    return this.vttMapValidatorService.validateParticipantAccess(
      roomId,
      userId,
    );
  }

  async validateMapAccess(mapId: string, userId: number) {
    return this.validator.validateMapAccess(mapId, userId);
  }

  async validateTokenMoveAccess(tokenId: string, userId: number) {
    return this.validator.validateMoveOrDeleteAccess(tokenId, userId);
  }

  async getVttMapForUser(mapId: string, userId: number) {
    return this.vttMapService.getVttMap(mapId, userId);
  }
  async getTokensByMap(
    mapId: string,
    userId: number,
  ): Promise<TokenResponseDto[]> {
    return this.tokenService.getTokensByMapForUser(mapId, userId);
  }

  async moveToken(
    tokenId: string,
    { x, y }: { x: number; y: number },
    userId: number,
  ) {
    return this.tokenService.updateToken(tokenId, { x, y }, userId);
  }

  async updateMap(mapId: string, updates: UpdateVttMapDto, userId: number) {
    return this.vttMapService.updateVttMap(mapId, userId, updates);
  }
}
