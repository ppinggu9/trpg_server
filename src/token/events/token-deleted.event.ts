export class TokenDeletedEvent {
  constructor(
    public readonly mapId: string,
    public readonly tokenId: string,
  ) {}
}
