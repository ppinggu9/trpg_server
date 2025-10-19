import { ApiProperty } from '@nestjs/swagger';

// common/dto/error-response.dto.ts
export class ErrorResponseDto {
  @ApiProperty()
  message: string;

  @ApiProperty({ required: false })
  details?: Record<string, any>;
}
