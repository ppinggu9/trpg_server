import { IsNumber, Min, IsOptional, IsString } from 'class-validator';

export class CreateSanLossDto {
  @IsNumber()
  @Min(0)
  amount: number;

  @IsString()
  @IsOptional()
  reason?: string;
}