import { IsString, IsNumber } from 'class-validator';
// src/token/dto/move-token.dto.ts
/**
 * Gateway 전용 DTO
 * - WebSocket을 통해 토큰 이동 요청 시 사용
 * - REST API에서는 사용되지 않음
 */
export class MoveTokenDto {
  @IsString()
  tokenId: string;

  @IsNumber()
  x: number;

  @IsNumber()
  y: number;
}
