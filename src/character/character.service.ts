import { Injectable, NotFoundException, InternalServerErrorException, Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Character } from './entities/character.entity';
import { Stats } from './entities/stats.entity';
import { CreateCharacterDto } from './dto/create-character.dto';
import { CharacterDetailResponseDto } from './dto/character-detail-response.dto';
import { plainToInstance } from 'class-transformer';

@Injectable()
export class CharacterService {
  private readonly logger = new Logger(CharacterService.name)
  constructor(
    @InjectRepository(Character)
    private readonly characterRepository: Repository<Character>,
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

  //캐릭터 조회
  async findOne(id: number): Promise<CharacterDetailResponseDto> {
    const character = await this.characterRepository.findOne({
      where: { id },
      relations: ['stats', 'weapons'],
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
      weapons: character.weapons || []
    });
  }
}
