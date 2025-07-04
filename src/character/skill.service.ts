import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Skill } from '../character/entities/skill.entity';
import { Character } from '../character/entities/character.entity';
import { CreateSkillDto } from '../character/dto/createdto/create-skill.dto';
import { UpdateSkillDto } from '../character/dto/update-skill.dto';
import { SkillResponseDto } from '../character/dto/responsedto/skill-response.dto';
import { plainToInstance } from 'class-transformer';

@Injectable()
export class SkillService {
  constructor(
    @InjectRepository(Skill)
    private readonly skillRepository: Repository<Skill>,
    @InjectRepository(Character)
    private readonly characterRepository: Repository<Character>,
  ) { }

  async createSkill(
    id: string,
    createSkillDto: CreateSkillDto
  ): Promise<SkillResponseDto> {
    const numericId = parseInt(id, 10);
    const character = await this.characterRepository.findOne({
      where: { id: numericId },
      relations: ['skills'],
    });
    if (!character) throw new NotFoundException(`캐릭터 ID ${id}를 찾을 수 없습니다.`);

    const skill = this.skillRepository.create({
      ...createSkillDto,
      character,
    });
    await this.skillRepository.save(skill);
    return this.transformSkill(skill);
  }

  async updateSkill(
    id: string,
    skillId: string,
    updateSkillDto: UpdateSkillDto,
  ): Promise<SkillResponseDto> {
    const numericSkillId = parseInt(skillId, 10);
    const skill = await this.skillRepository.findOne({
      where: { id: numericSkillId },
      relations: ['character'],
    });

    if (!skill) {
      throw new NotFoundException(`스킬 ID ${skillId}를 찾을 수 없습니다.`);
    }

    if (skill.character.id !== parseInt(id, 10)) {
      throw new ForbiddenException('해당 스킬을 수정할 권한이 없습니다.');
    }

    await this.skillRepository.update(numericSkillId, updateSkillDto);
    const updatedSkill = await this.skillRepository.findOneBy({ id: numericSkillId });
    if (!updatedSkill) {
      throw new NotFoundException(`업데이트 할 스킬${updatedSkill}를 찾을 수 없습니다.`);
    }
    return this.transformSkill(updatedSkill);
  }

  // 스킬 없애기 
  async deleteSkill(id: string, skillId: string): Promise<void> {
    const numericSkillId = parseInt(skillId, 10);
    const skill = await this.skillRepository.findOne({
      where: { id: numericSkillId },
      relations: ['character'],
    });

    if (!skill) {
      throw new NotFoundException(`스킬 ID ${skillId}를 찾을 수 없습니다.`);
    }

    if (skill.character.id !== parseInt(id, 10)) {
      throw new ForbiddenException('해당 스킬을 삭제할 권한이 없습니다.');
    }

    await this.skillRepository.remove(skill);
  }

  private transformSkill(skill: Skill): SkillResponseDto {
    return plainToInstance(SkillResponseDto, {
      ...skill,
      isHard: skill.value >= 50,
      isExtreme: skill.value >= 30,
    });
  }
}