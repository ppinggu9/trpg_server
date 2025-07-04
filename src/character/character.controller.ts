import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CharacterOwnershipGuard } from './guards/character-ownership.guard';
import { CharacterService } from './character.service';
import { CharacterExistsGuard } from './guards/character-exists.guard';
import { CharacterDetailResponseDto } from './dto/responsedto/character-detail-response.dto';
import { CreateWeaponDto } from './dto/createdto/create-weapon.dto';
import { WeaponResponseDto } from './dto/responsedto/weapon-response.dto';
import { UpdateWeaponDto } from './dto/update-weapon.dto';
import { CreateSkillDto } from './dto/createdto/create-skill.dto';
import { SkillResponseDto } from './dto/responsedto/skill-response.dto';
import { UpdateSkillDto } from './dto/update-skill.dto';
import { CreateSanLossDto } from './dto/createdto/create-san-loss.dto';
import { SanLossResponseDto } from './dto/responsedto/san-loss-response.dto';
import { WeaponService } from './weapon.service';
import { SkillService } from './skill.service';

@Controller('characters')
@UseGuards(
  JwtAuthGuard,               // 사용자 인증
  CharacterExistsGuard,       // 캐릭터 존재 여부 검증
  CharacterOwnershipGuard     // 소유권 검증
)
export class CharacterController {
  constructor(
    private readonly characterService: CharacterService,
    private readonly weaponService: WeaponService,
    private readonly skillService: SkillService, 
  ) { }

  //  캐릭터 조회
  @Get(':id')
  async findOne(@Param('id') id: number): Promise<CharacterDetailResponseDto> {
    return this.characterService.findOne(id);
  }

  //  무기 생성
  @Post(':id/weapons')
  async createWeapon(
    @Param('id') id: string,
    @Body() createWeaponDto: CreateWeaponDto,
  ): Promise<WeaponResponseDto> {
    return this.weaponService.createWeapon(id, createWeaponDto);
  }

  //  무기 업데이트
  @Patch(':id/weapons/:weaponId')
  async updateWeapon(
    @Param('id') id: string,
    @Param('weaponId') weaponId: string,
    @Body() updateWeaponDto: UpdateWeaponDto,
  ): Promise<WeaponResponseDto> {
    return this.weaponService.updateWeapon(id, weaponId, updateWeaponDto);
  }

  //  스킬 생성
  @Post(':id/skills')
  async createSkill(
    @Param('id') id: string,
    @Body() createSkillDto: CreateSkillDto,
  ): Promise<SkillResponseDto> {
    return this.skillService.createSkill(id, createSkillDto); 
  }

  //  스킬 업데이트
  @Patch(':id/skills/:skillId')
  async updateSkill(
    @Param('id') id: string,
    @Param('skillId') skillId: string,
    @Body() updateSkillDto: UpdateSkillDto,
  ): Promise<SkillResponseDto> {
    return this.skillService.updateSkill(id, skillId, updateSkillDto); 
  }

  //  스킬 삭제
  @Delete(':id/skills/:skillId') 
  async deleteSkill(
    @Param('id') id: string,
    @Param('skillId') skillId: string,
  ): Promise<void> {
    return this.skillService.deleteSkill(id, skillId); 
  }

  //  SAN 손실 기록
  @Post(':id/san-losses')
  async createSanLoss(
    @Param('id') id: string,
    @Body() createSanLossDto: CreateSanLossDto,
  ): Promise<SanLossResponseDto> {
    return this.characterService.createSanLoss(id, createSanLossDto);
  }
}