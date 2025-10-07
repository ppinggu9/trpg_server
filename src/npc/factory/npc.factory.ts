import { faker } from '@faker-js/faker';
import { Npc } from '../entities/npc.entity';
import { CreateNpcDto } from '../dto/create-npc.dto';
import { UpdateNpcDto } from '../dto/update-npc.dto';
import { NpcType } from '@/common/enums/npc-type.enum';
import { TrpgSystem } from '@/common/enums/trpg-system.enum';
import { Room } from '@/room/entities/room.entity';

export const createNpcDto = (
  options: Partial<CreateNpcDto> = {},
): CreateNpcDto => {
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
    type: options.type ?? NpcType.NPC,
  };
};

export const updateNpcDto = (
  options: Partial<UpdateNpcDto> = {},
): UpdateNpcDto => {
  return {
    data: options.data ?? {
      name: faker.person.fullName(),
      level: faker.number.int({ min: 1, max: 20 }),
      notes: faker.lorem.sentence(),
    },
    isPublic: options.isPublic,
    type: options.type,
  };
};

export const createNpcEntity = (
  options: Partial<Npc> & { trpgType?: TrpgSystem; room?: Room } = {},
): Npc => {
  const npc = new Npc();

  npc.id = options.id ?? faker.number.int({ min: 1, max: 10000 });
  npc.type = options.type ?? NpcType.NPC;
  npc.data = options.data ?? {
    name: faker.person.fullName(),
    level: faker.number.int({ min: 1, max: 20 }),
    hp: faker.number.int({ min: 10, max: 200 }),
    skills: ['Stealth', 'Perception', 'Arcana'].map((skill) => ({
      name: skill,
      value: faker.number.int({ min: 1, max: 100 }),
    })),
  };
  npc.isPublic = options.isPublic ?? faker.datatype.boolean();
  npc.trpgType = options.trpgType ?? TrpgSystem.DND5E;
  npc.createdAt = options.createdAt ?? faker.date.past();
  npc.updatedAt = options.updatedAt ?? faker.date.recent();

  return Object.assign(npc, options);
};
