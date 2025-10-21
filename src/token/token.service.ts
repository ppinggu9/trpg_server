import { Injectable } from '@nestjs/common';
import { CreateTokenDto } from './dto/create-token.dto';
import { UpdateTokenDto } from './dto/update-token.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Token } from './entities/token.entity';
import { Repository } from 'typeorm';
import { TokenValidatorService } from './token-validator.service';
import { TokenResponseDto } from './dto/token-response.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TokenCreatedEvent } from './events/token-created.event';
import { TokenUpdatedEvent } from './events/token-updated.event';
import { TokenDeletedEvent } from './events/token-deleted.event';
import { TOKEN_EVENTS } from './constants/events';

@Injectable()
export class TokenService {
  constructor(
    @InjectRepository(Token)
    private readonly tokenRepository: Repository<Token>,
    private readonly validator: TokenValidatorService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private toResponseDto(token: Token): TokenResponseDto {
    return {
      id: token.id,
      mapId: token.mapId,
      name: token.name,
      x: token.x,
      y: token.y,
      scale: token.scale,
      imageUrl: token.imageUrl,
      characterSheetId: token.characterSheetId,
      npcId: token.npcId,
    };
  }

  async createToken(
    mapId: string,
    dto: CreateTokenDto,
    userId: number,
  ): Promise<TokenResponseDto> {
    this.validator.validateOwnershipRelation(dto);
    await this.validator.validateCreateAccess(mapId, dto, userId);

    const token = this.tokenRepository.create({
      mapId,
      name: dto.name,
      x: dto.x,
      y: dto.y,
      scale: dto.scale ?? 1.0,
      imageUrl: dto.imageUrl,
      characterSheetId: dto.characterSheetId,
      npcId: dto.npcId,
    });

    console.log('[DEBUG] createToken - token to save:', token);

    const saved = await this.tokenRepository.save(token);
    const responseDto = this.toResponseDto(saved);

    this.eventEmitter.emit(
      TOKEN_EVENTS.CREATED,
      new TokenCreatedEvent(mapId, responseDto),
    );

    console.log('[DEBUG] createToken - saved token:', saved);
    return responseDto;
  }

  async updateToken(
    tokenId: string,
    dto: UpdateTokenDto,
    userId: number,
  ): Promise<TokenResponseDto> {
    const token = await this.validator.validateMoveOrDeleteAccess(
      tokenId,
      userId,
    );
    Object.assign(token, dto);
    const updated = await this.tokenRepository.save(token);
    const responseDto = this.toResponseDto(updated);

    this.eventEmitter.emit(
      TOKEN_EVENTS.UPDATED,
      new TokenUpdatedEvent(token.mapId, responseDto),
    );

    return responseDto;
  }

  async getTokensByMap(
    mapId: string,
    userId: number,
  ): Promise<TokenResponseDto[]> {
    await this.validator.validateMapAccess(mapId, userId);
    const tokens = await this.tokenRepository.find({ where: { mapId } });
    console.log('[DEBUG] getTokensByMap - raw tokens from DB:', tokens);

    const responseDtos = tokens.map((t) => this.toResponseDto(t));
    console.log('[DEBUG] getTokensByMap - response DTOs:', responseDtos);
    return responseDtos;
  }

  async deleteToken(tokenId: string, userId: number): Promise<void> {
    const token = await this.validator.validateMoveOrDeleteAccess(
      tokenId,
      userId,
    );
    await this.tokenRepository.softRemove(token);

    this.eventEmitter.emit(
      TOKEN_EVENTS.DELETED,
      new TokenDeletedEvent(token.mapId, tokenId),
    );
  }

  //vtt gateway에서 token을 받아올때 사용한다
  async getTokensByMapForUser(
    mapId: string,
    userId: number,
  ): Promise<TokenResponseDto[]> {
    await this.validator.validateMapAccess(mapId, userId);
    const tokens = await this.tokenRepository.find({
      where: { mapId },
    });
    return tokens.map((t) => this.toResponseDto(t));
  }
}
