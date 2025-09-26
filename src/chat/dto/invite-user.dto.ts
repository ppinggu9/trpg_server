import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty } from 'class-validator';

export class InviteUserDto {
  @ApiProperty({ example: 102, description: '초대할 사용자 ID' })
  @IsInt()
  @IsNotEmpty()
  userId: number;
}
