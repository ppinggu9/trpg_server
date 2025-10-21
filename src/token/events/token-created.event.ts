import { TokenResponseDto } from '../dto/token-response.dto';

// src/token/events/token-created.event.ts
export class TokenCreatedEvent {
  constructor(
    public readonly mapId: string,
    public readonly token: TokenResponseDto,
  ) {}
}
