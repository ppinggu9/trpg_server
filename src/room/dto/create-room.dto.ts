import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsInt,
  Min,
  Max,
  MinLength,
  MaxLength,
} from 'class-validator';

export class CreateRoomDto {
  @ApiProperty({ description: '방 이름 (1~50자)' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name: string;

  @ApiProperty({ description: '비밀번호 (4자 이상)' })
  @IsString()
  @MinLength(4)
  password?: string;

  @ApiProperty({ description: '최대 참여자 수 (2~8)', default: 2 })
  @IsInt()
  @Min(2)
  @Max(8)
  maxParticipants: number = 2;
}

