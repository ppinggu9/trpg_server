import { Injectable, NotFoundException, InternalServerErrorException, Logger, ForbiddenException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Character } from './entities/character.entity';
import { Stats } from './entities/stats.entity';
import { CreateCharacterDto } from './dto/createdto/create-character.dto';
import { plainToInstance } from 'class-transformer';
import { CharacterDetailResponseDto } from './dto/responsedto/character-detail-response.dto';
import { SanLoss } from './entities/san-loss.entity';
import { SanLossResponseDto } from './dto/responsedto/san-loss-response.dto';
import { CreateSanLossDto } from './dto/createdto/create-san-loss.dto';


@Injectable()
export class CharacterService {
  private readonly logger = new Logger(CharacterService.name)
  constructor(
    @InjectRepository(Character)
    private readonly characterRepository: Repository<Character>,
    @InjectRepository(SanLoss)
    private readonly sanLossRepository: Repository<SanLoss>,
  ) { }

  // hp
  calculateHP(stats: Stats): number {
    return Math.round((stats.con + stats.siz) / 10);
  }

  // stats 계산 coc 7판 규칙적용
  calculateDB(stats: Stats): string {
    const sum = stats.str + stats.siz;
    if (sum <= 12) return '-2D6';
    if (sum <= 16) return '-1D6';
    if (sum <= 24) return '-1D4';
    if (sum <= 32) return '+0';
    if (sum <= 40) return '+1D4';
    return '+1D6';
  }

  //san 
  calculateSAN(stats: Stats): number {
    return stats.pow * 5;
  }

  // 외부에서 캐릭터 존재성 검증을 요청하는 공개 메서드
  async getCharacterById(id: number): Promise<Character> {
    const character = await this.characterRepository.findOneBy({ id });
    if (!character) {
      throw new NotFoundException(`캐릭터 ID ${id}를 찾을 수 없습니다.`);
    }
    return character;
  }

  //  외부에서 캐릭터 소유권 검증을 요청하는 공개 메서드
  async verifyCharacterOwnership(id: number, userId: number): Promise<void> {
    const character = await this.getCharacterById(id);
    if (character.id !== userId) {
      throw new ForbiddenException('해당 캐릭터에 접근할 권한이 없습니다.');
    }
  }

  // 캐릭터 생성
  async create(createCharacterDto: CreateCharacterDto): Promise<CharacterDetailResponseDto> {
    try {
      const character = this.characterRepository.create(createCharacterDto);
      await this.characterRepository.save(character);

      return plainToInstance(CharacterDetailResponseDto, {
        id: character.id,
        name: character.name,
        hp: this.calculateHP(character.stats),
        db: this.calculateDB(character.stats),
        san: this.calculateSAN(character.stats),
        stats: character.stats,
      });
    } catch (error) {
      this.logger.error(`캐릭터 생성 실패: ${error.message}`, error.stack);
      throw new InternalServerErrorException('캐릭터 생성 중 오류가 발생했습니다.');
    }
  }

  // san-losses 값 만들기 
  async createSanLoss(
    id: string,
    createSanLossDto: CreateSanLossDto
  ): Promise<SanLossResponseDto> {
    const numericId = parseInt(id, 10);
    const character = await this.characterRepository.findOneBy({ id: numericId });

    if (!character) {
      throw new NotFoundException(`캐릭터 ID ${id}를 찾을 수 없습니다.`);
    }

    const sanLoss = this.sanLossRepository.create({
      ...createSanLossDto,
      character, //  캐릭터와 관계 설정
    });

    await this.sanLossRepository.save(sanLoss);
    return this.transformSanLoss(sanLoss);
  }

  //캐릭터 조회
  async findOne(id: number): Promise<CharacterDetailResponseDto> {
    const character = await this.characterRepository.findOne({
      where: { id },
      relations: ['stats', 'skills', 'weapons', 'sanLosses',],
      withDeleted: true
    });
    if (!character) {
      throw new NotFoundException(`캐릭터 ID ${id}를 찾을 수 없습니다.`);
    }
    if (!character.stats) {
      throw new InternalServerErrorException('스탯 정보가 누락되었습니다.');
    }

    return plainToInstance(CharacterDetailResponseDto, {
      id: character.id,
      name: character.name,
      hp: this.calculateHP(character.stats),
      db: this.calculateDB(character.stats),
      san: this.calculateSAN(character.stats),
      stats: character.stats,
      weapons: character.weapons || [],
      sanLosses: character.sanLosses?.map(san => this.transformSanLoss(san)) || []
    });
  }
  private transformSanLoss(sanLoss: SanLoss): SanLossResponseDto {
    return plainToInstance(SanLossResponseDto, {
      ...sanLoss,
      totalSanLoss: sanLoss.amount, // 예시: 추가 계산이 필요한 경우
      effectiveDate: sanLoss.createdAt
    });
  }
}
