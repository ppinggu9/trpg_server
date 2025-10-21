import { TokenResponseDto } from '../dto/token-response.dto';

export class TokenUpdatedEvent {
  constructor(
    public readonly mapId: string,
    public readonly token: TokenResponseDto,
  ) {}
}
