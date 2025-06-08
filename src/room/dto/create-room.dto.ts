import {
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateRoomDto {
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  name: string;

  @IsString()
  @IsOptional()
  @MinLength(4)
  @MaxLength(20)
  password?: string;

  // 기본인원 2명
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(2)
  @Max(20)
  maxParticipants: number = 2;
}
