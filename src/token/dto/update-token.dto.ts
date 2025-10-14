import { IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateTokenDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsNumber()
  @IsOptional()
  x?: number;

  @IsNumber()
  @IsOptional()
  y?: number;

  @IsNumber()
  @IsOptional()
  scale?: number;

  @IsString()
  @IsOptional()
  imageUrl?: string;
}
