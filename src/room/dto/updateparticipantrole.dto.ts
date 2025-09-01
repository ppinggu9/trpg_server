import { ParticipantRole } from '@/common/enums/participant-role.enum';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { ROOM_ERRORS } from '../constants/room.constants';

export class UpdateParticipantRoleDto {
  @ApiProperty({
    description: '변경할 역할',
    enum: ParticipantRole,
  })
  @IsEnum(ParticipantRole, {
    message: ROOM_ERRORS.INVALID_PARTICIPANT_ROLE,
  })
  role: ParticipantRole;
}
