import { faker } from '@faker-js/faker';
import { VttMap } from '../entities/vttmap.entity';
import { v4 as uuidv4 } from 'uuid';
import { createRoomEntity } from '@/room/factory/room.factory';
import { GridType } from '@/common/enums/grid-type.enum';

export const createVttMapEntity = (options: Partial<VttMap> = {}): VttMap => {
  const vttMap = new VttMap();

  vttMap.id = options.id ?? uuidv4();
  vttMap.name = options.name ?? faker.lorem.words(2).substring(0, 50);
  vttMap.imageUrl = options.imageUrl ?? faker.image.url();
  vttMap.gridType =
    options.gridType ?? faker.helpers.arrayElement(Object.values(GridType));
  vttMap.gridSize = options.gridSize ?? faker.number.int({ min: 10, max: 200 });
  vttMap.showGrid = options.showGrid ?? faker.datatype.boolean();

  if (options.roomId) {
    vttMap.roomId = options.roomId;
  } else {
    vttMap.room = options.room ?? createRoomEntity();
  }

  vttMap.createdAt = options.createdAt ?? new Date();
  vttMap.updatedAt = options.updatedAt ?? new Date();

  return vttMap;
};
