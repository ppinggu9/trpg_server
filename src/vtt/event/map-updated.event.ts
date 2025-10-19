// src/vtt/events/map-updated.event.ts
import { VttMap } from '@/vttmap/entities/vttmap.entity';

export class MapUpdatedEvent {
  constructor(
    public readonly mapId: string,
    public readonly payload: Partial<VttMap>,
  ) {}
}
