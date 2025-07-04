import { IsString, IsEnum, IsNumber, Min, Max } from 'class-validator';
import { ValidStats } from 'src/character/entities/weapon.entity';

export class CreateWeaponDto {
  @IsString()
  name: string;

  @IsEnum(ValidStats)
  attackStat: ValidStats;

  @IsString()
  damageDice: string;

  @IsNumber()
  @Min(0)
  damageBonus: number;

  @IsNumber()
  @Min(0)
  successRate: number;
}