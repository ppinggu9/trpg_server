import { IsString, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { StatsDto } from './stats.dto';
import { WeaponDto } from './weapon';

export class CreateCharacterDto {
  @IsString()
  readonly name: string;
 
  @IsString()
  @IsOptional()
  readonly imageUrl?: string;

  @IsString()
  readonly occupation: string;

  @ValidateNested({ each: true })
  @Type(() => WeaponDto)
  @IsOptional()
  readonly weapons?: WeaponDto[];

  @ValidateNested()
  @Type(() => StatsDto)
  readonly stats: StatsDto;
}