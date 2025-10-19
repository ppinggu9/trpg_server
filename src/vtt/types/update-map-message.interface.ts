// src/vtt/types/update-map-message.interface.ts
import { GridType } from '@/common/enums/grid-type.enum';

export interface UpdateMapMessage {
  mapId: string;
  updates: Partial<{
    name?: string | null;
    imageUrl?: string | null;
    gridType?: GridType;
    gridSize?: number;
    showGrid?: boolean;
  }>;
}
