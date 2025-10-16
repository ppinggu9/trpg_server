import { Injectable } from '@nestjs/common';
import { CreateTokenDto } from './dto/create-token.dto';
import { UpdateTokenDto } from './dto/update-token.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Token } from './entities/token.entity';
import { Repository } from 'typeorm';
import { TokenValidatorService } from './token-validator.service';
import { TokenResponseDto } from './dto/token-response.dto';

@Injectable()
export class TokenService {
  constructor(
    @InjectRepository(Token)
    private readonly tokenRepository: Repository<Token>,
    private readonly validator: TokenValidatorService,
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
    await this.validator.validateMapAccess(mapId, userId);

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

    const saved = await this.tokenRepository.save(token);
    return this.toResponseDto(saved);
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
    return this.toResponseDto(updated);
  }

  async getTokensByMap(
    mapId: string,
    userId: number,
  ): Promise<TokenResponseDto[]> {
    await this.validator.validateMapAccess(mapId, userId);
    const tokens = await this.tokenRepository.find({ where: { mapId } });
    return tokens.map((t) => this.toResponseDto(t));
  }

  async deleteToken(tokenId: string, userId: number): Promise<void> {
    const token = await this.validator.validateMoveOrDeleteAccess(
      tokenId,
      userId,
    );
    await this.tokenRepository.softRemove(token);
  }
}
