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
  // Trpg는 room에서 생성되므로 room.service을 통해 생성된 값을 받아야한다.
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

  sheet.participant =
    options.participant ??
    createParticipantEntity({
      // 필요시, 이 팩토리 내에서만 특별히 설정하고 싶은 Participant 옵션
      // 예: characterSheet: sheet (순환 참조 주의, 보통은 하지 않음)
      // role: ParticipantRole.PLAYER,
    });
  return Object.assign(sheet, options);
};
