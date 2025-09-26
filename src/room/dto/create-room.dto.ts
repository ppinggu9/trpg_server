import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsInt,
  Min,
  Max,
  MinLength,
  MaxLength,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { ROOM_ERRORS } from '../constants/room.constants';
import { TrpgSystem } from '@/common/enums/trpg-system.enum';

export class CreateRoomDto {
  @ApiProperty({
    description: 'TRPG 시스템 선택',
    enum: TrpgSystem,
    default: TrpgSystem.DND5E,
  })
  @IsEnum(TrpgSystem, {
    message: ROOM_ERRORS.INVALID_TRPG_SYSTEM,
  })
  system?: TrpgSystem = TrpgSystem.DND5E;

  @ApiProperty({
    description: '방 이름 (1~50자)',
    example: '고블린 사냥',
  })
  @IsString()
  @MinLength(1, { message: ROOM_ERRORS.INVALID_ROOM_NAME })
  @MaxLength(50, { message: ROOM_ERRORS.INVALID_ROOM_NAME_LENGTH })
  name: string;

  @ApiProperty({
    description: '방 비밀번호 (변경 불가)',
    example: '123',
  })
  @IsString()
  @MinLength(1, { message: ROOM_ERRORS.PASSWORD_REQUIRED })
  password: string;

  @ApiProperty({
    description: '최대 참여자 수 (2~8)',
    default: 2,
    minimum: 2,
    maximum: 8,
  })
  @IsInt()
  @Min(2, { message: ROOM_ERRORS.INVALID_MAX_PARTICIPANTS_MIN })
  @Max(8, { message: ROOM_ERRORS.INVALID_MAX_PARTICIPANTS_MAX })
  @IsOptional()
  maxParticipants?: number = 2;
}
