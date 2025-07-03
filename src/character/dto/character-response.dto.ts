import { IsString, IsOptional, Min, Max } from 'class-validator';

export class StatsDto {
  @Min(0)
  @Max(100)
  str: number;

  @Min(0)
  @Max(100)
  con: number;

  @Min(0)
  @Max(100)
  siz: number;

  @Min(0)
  @Max(100)
  dex: number;

  @Min(0)
  @Max(100)
  app: number;

  @Min(0)
  @Max(100)
  int: number;

  @Min(0)
  @Max(100)
  pow: number;

  @Min(0)
  @Max(100)
  edu: number;

  @Min(0)
  @Max(100)
  luck: number;
}

export class CreateCharacterDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsString()
  occupation: string;

  stats?: StatsDto;
}