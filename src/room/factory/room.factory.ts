import { faker } from '@faker-js/faker';
import { Room } from '../entities/room.entity';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { RoomParticipant } from '../entities/room-participant.entity';
import { createUserEntity } from '@/users/factory/user.factory';
import { ParticipantRole } from '@/common/enums/participant-role.enum';

export const createRoomEntity = (options: Partial<Room> = {}): Room => {
  const room = new Room();

  // 기본값 설정
  room.id = options.id ?? uuidv4();
  room.name =
    options.name ?? `${faker.lorem.words(2).substring(0, 45)}_${Date.now()}`;
  room.password =
    options.password !== undefined
      ? options.password
      : bcrypt.hashSync(faker.internet.password({ length: 20 }), 10);
  room.maxParticipants =
    options.maxParticipants ?? faker.number.int({ min: 2, max: 8 });
  room.createdAt = options.createdAt ?? new Date();
  room.updatedAt = options.updatedAt ?? new Date();
  room.deletedAt = options.deletedAt ?? null;
  room.creator =
    options.creator !== undefined ? options.creator : createUserEntity();

  room.participants = options.participants ?? [];

  return room;
};

export const createParticipantEntity = (
  overrides: Partial<RoomParticipant> = {},
): RoomParticipant => {
  const participant = new RoomParticipant();

  // 명시되지 않은 값은 undefined 유지
  participant.id = overrides.id ?? 1;
  participant.room = overrides.room ?? undefined;
  participant.user = overrides.user ?? createUserEntity();
  participant.joinedAt = overrides.joinedAt ?? new Date();
  participant.leftAt = overrides.leftAt ?? null;
  participant.role = overrides.role ?? ParticipantRole.PLAYER;

  return participant;
};
