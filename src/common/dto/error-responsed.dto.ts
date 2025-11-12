import { ApiProperty } from '@nestjs/swagger';

export class ErrorResponseDto {
  @ApiProperty()
  message: string;

  @ApiProperty({ required: false })
  details?: Record<string, any>;
}
