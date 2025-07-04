import { IsString, Min, Max } from 'class-validator';

export class CreateSkillDto {
  @IsString()
  name: string;

  @Min(0)
  @Max(100)
  value: number;
}