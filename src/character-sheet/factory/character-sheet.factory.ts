import { faker } from '@faker-js/faker';
import { CharacterSheet } from '../entities/character-sheet.entity';
import { CreateCharacterSheetDto } from '../dto/create-character-sheet.dto';
import { UpdateCharacterSheetDto } from '../dto/update-character-sheet.dto';
import { createParticipantEntity } from '@/room/factory/room.factory';

export const createCharacterSheetDto = (
  options: Partial<CreateCharacterSheetDto> = {},
): CreateCharacterSheetDto => {
  return {
    data: options.data ?? {
      name: faker.person.fullName(),
      level: faker.number.int({ min: 1, max: 20 }),
      hp: faker.number.int({ min: 10, max: 200 }),
      attributes: {
        str: faker.number.int({ min: 8, max: 18 }),
        dex: faker.number.int({ min: 8, max: 18 }),
        con: faker.number.int({ min: 8, max: 18 }),
      },
    },
    isPublic: options.isPublic ?? faker.datatype.boolean(),
  };
};

export const updateCharacterSheetDto = (
  options: Partial<UpdateCharacterSheetDto> = {},
): UpdateCharacterSheetDto => {
  return {
    data: options.data ?? {
      name: faker.person.fullName(),
      level: faker.number.int({ min: 1, max: 20 }),
      notes: faker.lorem.sentence(),
    },
    isPublic: options.isPublic,
  };
};

export const createCharacterSheet = (
  options: Partial<CharacterSheet> = {},
): CharacterSheet => {
  const sheet = new CharacterSheet();
  sheet.id = options.id ?? faker.number.int({ min: 1, max: 10000 });
  sheet.data = options.data ?? {
    name: faker.person.fullName(),
    level: faker.number.int({ min: 1, max: 20 }),
    hp: faker.number.int({ min: 10, max: 200 }),
    skills: ['Stealth', 'Perception', 'Arcana'].map((skill) => ({
      name: skill,
      value: faker.number.int({ min: 1, max: 100 }),
    })),
  };
  sheet.isPublic = options.isPublic ?? faker.datatype.boolean();
  sheet.createdAt = options.createdAt ?? faker.date.past();
  sheet.updatedAt = options.updatedAt ?? faker.date.recent();

  sheet.participant = options.participant ?? createParticipantEntity({});
  return Object.assign(sheet, options);
};
