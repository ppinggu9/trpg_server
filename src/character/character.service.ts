// src/character/services/character.service.ts
import { Injectable, NotFoundException, InternalServerErrorException, Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Character } from './entities/character.entity';
import { Stats } from './entities/stats.entity';

@Injectable()
export class CharacterService {
  constructor(
    @InjectRepository(Character)
    private readonly characterRepository: Repository<Character>,
    private readonly logger = new Logger(CharacterService.name)
  ) { }

  calculateHP(stats: Stats): number {
    return Math.round((stats.con + stats.siz) / 10);
  }

  calculateDB(stats: Stats): string {
    const sum = stats.str + stats.siz;
    if (sum <= 12) return '-2D6';
    if (sum <= 16) return '-1D6';
    if (sum <= 24) return '-1D4';
    if (sum <= 32) return '+0';
    if (sum <= 40) return '+1D4';
    return '+1D6';
  }

  calculateSAN(stats: Stats): number {
    return stats.pow * 5;
  }

  async findOne(id: string): Promise<NewType> {
    let character: Character;
    try {
      character = await this.characterRepository.findOneOrFail(id, {
        relations: ['stats', 'skills', 'sanLosses'],
        withDeleted: true
      });
    } catch (error) {
      if (error.name === 'EntityNotFoundError') {
        this.logger.warn(`Character with ID ${id} not found`);
        throw new NotFoundException(`캐릭터 ID ${id}를 찾을 수 없습니다.`);
      }
      this.logger.error(`Failed to find character with ID ${id}: ${error.message}`, error.stack);
      throw new InternalServerErrorException('캐릭터 정보를 조회하는 중 오류가 발생했습니다.');
    }

    try {
      if (!character.stats) {
        this.logger.error(`Character ${id} has no stats`);
        throw new InternalServerErrorException('스탯 정보가 누락되었습니다.');
      }

      return {
        ...character,
        hp: this.calculateHP(character.stats),
        db: this.calculateDB(character.stats),
        san: this.calculateSAN(character.stats),
        skills: character.skills?.map(skill => ({
          ...skill,
          isHard: skill.value >= 50,
          isExtreme: skill.value >= 30
        })) || [],
        sanLosses: character.sanLosses || []
      };
    } catch (error) {
      this.logger.error(`Character data processing failed`, error.stack);
      throw new InternalServerErrorException('캐릭터 데이터 처리 중 오류가 발생했습니다.');
    }
  }
}