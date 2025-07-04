import { Expose, Type } from 'class-transformer';
import { StatsResponseDto } from './stats-response.dto';
import { SkillResponseDto } from './skill-response.dto';
import { WeaponResponseDto } from './weapon-response.dto';
import { SanLossResponseDto } from './san-loss-response.dto';


export class CharacterDetailResponseDto {
  @Expose()
  id: number;

  @Expose()
  name: string;

  @Expose()
  hp: number;

  @Expose()
  db: string;

  @Expose()
  san: number;

  @Expose()
  @Type(() => StatsResponseDto)
  stats: StatsResponseDto;

  @Expose()
  @Type(() => SkillResponseDto)
  skills: SkillResponseDto[];

  @Expose()
  @Type(() => WeaponResponseDto)
  weapons: WeaponResponseDto[];

  @Expose()
  @Type(() => SanLossResponseDto)
  sanLosses: SanLossResponseDto[];
}