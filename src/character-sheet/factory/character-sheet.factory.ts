import { faker } from '@faker-js/faker';
import { CharacterSheet } from '../entities/character-sheet.entity';
import { TrpgSystem } from '@/common/enums/trpg-system.enum';
import { CreateCharacterSheetDto } from '../dto/create-character-sheet.dto';
import { UpdateCharacterSheetDto } from '../dto/update-character-sheet.dto';
import { createParticipantEntity } from '@/room/factory/room.factory';

export const createCharacterSheetDto = (
  options: Partial<CreateCharacterSheetDto> = {},
): CreateCharacterSheetDto => {
  return {
    trpgType:
      options.trpgType ?? faker.helpers.arrayElement(Object.values(TrpgSystem)),
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
  sheet.trpgType =
    options.trpgType ?? faker.helpers.arrayElement(Object.values(TrpgSystem));
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
