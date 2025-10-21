// src/vtt/events/map-deleted.event.ts
export class MapDeletedEvent {
  constructor(
    public readonly roomId: string,
    public readonly mapId: string,
  ) {}
}
