import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsInt,
  Min,
  Max,
  MinLength,
  MaxLength,
  IsOptional,
} from 'class-validator';

export class CreateRoomDto {
  @ApiProperty({
    description: '방 이름 (1~50자)',
    example: '고블린 사냥',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name: string;

  @ApiProperty({
    description: '방 비밀번호 (변경 불가)',
    example: '123',
  })
  @IsString()
  password: string;

  @ApiProperty({
    description: '최대 참여자 수 (2~8)',
    default: 2,
    minimum: 2,
    maximum: 8,
  })
  @IsInt()
  @Min(2)
  @Max(8)
  @IsOptional()
  maxParticipants?: number = 2;
}
