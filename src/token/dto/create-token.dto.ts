import { IsString, IsNumber, IsOptional, IsInt } from 'class-validator';

export class CreateTokenDto {
  @IsString()
  name: string;

  @IsNumber()
  x: number;

  @IsNumber()
  y: number;

  @IsNumber()
  @IsOptional()
  scale?: number;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsInt()
  @IsOptional()
  characterSheetId?: number | null;

  @IsInt()
  @IsOptional()
  npcId?: number | null;
}
