// src/vtt/events/map-created.event.ts
import { VttMapDto } from '@/vttmap/dto/vttmap.dto';

export class MapCreatedEvent {
  constructor(
    public readonly roomId: string,
    public readonly map: VttMapDto,
  ) {}
}
