import { ParticipantRole } from '@/common/enums/participant-role.enum';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export class UpdateParticipantRoleDto {
  @ApiProperty({
    description: '변경할 역할',
    enum: ParticipantRole,
  })
  @IsEnum(ParticipantRole)
  role: ParticipantRole;
}
