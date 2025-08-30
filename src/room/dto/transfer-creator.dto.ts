import { ApiProperty } from '@nestjs/swagger';
import { IsNumber } from 'class-validator';

export class TransferCreatorDto {
  @ApiProperty({ description: '새로운 방장의 사용자 ID' })
  @IsNumber()
  newCreatorId: number;
}
