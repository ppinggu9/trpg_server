import { IsString, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { StatsDto } from '../stats.dto';
import { WeaponDto } from '../weapon.dto';
import { CreateSkillDto } from './create-skill.dto';
import { CreateSanLossDto } from './create-san-loss.dto';

export class CreateCharacterDto {
  @IsString()
  readonly name: string;

  @IsString()
  @IsOptional()
  readonly imageUrl?: string;

  @IsString()
  readonly occupation: string;

  @ValidateNested()
  @Type(() => StatsDto)
  readonly stats: StatsDto;
  
  @ValidateNested({ each: true })
  @Type(() => CreateSkillDto)
  @IsOptional()
  readonly skills?: CreateSkillDto[];

  @ValidateNested({ each: true })
  @Type(() => CreateSanLossDto)
  @IsOptional()
  readonly sanLosses?: CreateSanLossDto[];

  @ValidateNested({ each: true })
  @Type(() => WeaponDto)
  @IsOptional()
  readonly weapons?: WeaponDto[];


}