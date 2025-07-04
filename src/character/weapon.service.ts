import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Weapon } from '../character/entities/weapon.entity';
import { Character } from '../character/entities/character.entity';
import { CreateWeaponDto } from '../character/dto/createdto/create-weapon.dto';
import { UpdateWeaponDto } from '../character/dto/update-weapon.dto';
import { WeaponResponseDto } from '../character/dto/responsedto/weapon-response.dto';
import { plainToInstance } from 'class-transformer';

@Injectable()
export class WeaponService {
  constructor(
    @InjectRepository(Weapon)
    private readonly weaponRepository: Repository<Weapon>,
    @InjectRepository(Character)
    private readonly characterRepository: Repository<Character>,
  ) {}

  async createWeapon(
    id: string,
    createWeaponDto: CreateWeaponDto
  ): Promise<WeaponResponseDto> {
    const numericId = parseInt(id, 10);
    const character = await this.characterRepository.findOneBy({ id: numericId });
    if (!character) throw new NotFoundException(`캐릭터 ID ${id}를 찾을 수 없습니다.`);
    
    const weapon = this.weaponRepository.create({
      ...createWeaponDto,
      character,
    });
    await this.weaponRepository.save(weapon);
    return plainToInstance(WeaponResponseDto, weapon);
  }

  async updateWeapon(
    id: string,
    weaponId: string,
    updateWeaponDto: UpdateWeaponDto
  ): Promise<WeaponResponseDto> {
    const numericWeaponId = parseInt(weaponId, 10);
    const weapon = await this.weaponRepository.findOne({
      where: { id: numericWeaponId },
      relations: ['character'],
    });
    if (!weapon) throw new NotFoundException(`무기 ID ${weaponId}를 찾을 수 없습니다.`);
    if (weapon.character.id !== parseInt(id, 10)) throw new ForbiddenException('권한 없음');
    
    await this.weaponRepository.update(numericWeaponId, updateWeaponDto);
    const updatedWeapon = await this.weaponRepository.findOneBy({ id: numericWeaponId });
    return plainToInstance(WeaponResponseDto, updatedWeapon);
  }
}