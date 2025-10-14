import { IsString, IsNumber, IsOptional } from 'class-validator';

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

  @IsNumber()
  @IsOptional()
  characterSheetId?: number;

  @IsNumber()
  @IsOptional()
  npcId?: number;
}
