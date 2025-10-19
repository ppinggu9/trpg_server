import { ApiProperty } from '@nestjs/swagger';

export class DeleteVttMapResponseDto {
  @ApiProperty({
    example: true,
    description: '맵 삭제 성공 여부',
  })
  success: boolean;

  @ApiProperty({
    example: '맵이 삭제되었습니다.',
    description: '응답 메시지',
  })
  message: string;

  constructor(success = true, message = '맵이 삭제되었습니다.') {
    this.success = success;
    this.message = message;
  }
}
