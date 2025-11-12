import { faker } from '@faker-js/faker';
import { v4 as uuidv4 } from 'uuid';
import { CreateTokenDto } from '../dto/create-token.dto';
import { UpdateTokenDto } from '../dto/update-token.dto';
import { Token } from '../entities/token.entity';
import { createVttMapEntity } from '@/vttmap/factory/vttmap.factory';

export const createTokenDto = (
  options: Partial<CreateTokenDto> = {},
): CreateTokenDto => {
  return {
    name: options.name ?? faker.lorem.word(),
    x: options.x ?? faker.number.float({ min: 0, max: 1000 }),
    y: options.y ?? faker.number.float({ min: 0, max: 1000 }),
    scale: options.scale,
    imageUrl: options.imageUrl ?? faker.image.url(),
    characterSheetId: options.characterSheetId,
    npcId: options.npcId,
  };
};

export const updateTokenDto = (
  options: Partial<UpdateTokenDto> = {},
): UpdateTokenDto => {
  return {
    name: options.name,
    x: options.x ?? faker.number.float({ min: 0, max: 1000 }),
    y: options.y ?? faker.number.float({ min: 0, max: 1000 }),
    scale: options.scale,
    imageUrl: options.imageUrl,
  };
};

export const createTokenEntity = (options: Partial<Token> = {}): Token => {
  const token = new Token();

  token.id = options.id ?? uuidv4();
  token.mapId = options.mapId ?? uuidv4();
  token.name = options.name ?? faker.lorem.word();
  token.x = options.x ?? faker.number.float({ min: 0, max: 1000 });
  token.y = options.y ?? faker.number.float({ min: 0, max: 1000 });
  token.scale = options.scale ?? 1.0;
  token.imageUrl = options.imageUrl ?? faker.image.url();
  token.characterSheetId = options.characterSheetId ?? null;
  token.npcId = options.npcId ?? null;
  token.createdAt = options.createdAt ?? faker.date.past();
  token.updatedAt = options.updatedAt ?? faker.date.recent();

  if (options.map !== undefined) {
    token.map = options.map;
  } else if (options.mapId) {
    token.map = createVttMapEntity({ id: options.mapId });
  }

  return Object.assign(token, options);
};
