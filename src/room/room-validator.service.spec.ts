import { Test, TestingModule } from '@nestjs/testing';
import { RoomValidatorService } from './room-validator.service';
import { RoomParticipantService } from './room-participant.service';
import { Repository } from 'typeorm';
import { RoomParticipant } from './entities/room-participant.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createMock } from '@golevelup/ts-jest';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Room } from './entities/room.entity';
import { User } from '@/users/entities/user.entity';
import * as bcrypt from 'bcryptjs';
import { ParticipantRole } from '@/common/enums/participant-role.enum';
import { ROOM_ERRORS } from './constants/room.constants';
import { createRoomEntity } from './factory/room.factory';
import { createUserEntity } from '@/users/factory/user.factory';
import { createParticipantEntity } from './factory/room.factory';

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
  hashSync: jest.fn(),
}));

describe('방 검증 서비스', () => {
  let validatorService: RoomValidatorService;
  let roomParticipantService: RoomParticipantService;
  let roomParticipantRepository: Repository<RoomParticipant>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoomValidatorService,
        {
          provide: RoomParticipantService,
          useValue: createMock<RoomParticipantService>(),
        },
        {
          provide: getRepositoryToken(RoomParticipant),
          useValue: createMock<Repository<RoomParticipant>>(), // useClass 대신 useValue 사용
        },
      ],
    }).compile();

    validatorService = module.get<RoomValidatorService>(RoomValidatorService);
    roomParticipantService = module.get<RoomParticipantService>(
      RoomParticipantService,
    );
    roomParticipantRepository = module.get<Repository<RoomParticipant>>(
      getRepositoryToken(RoomParticipant),
    );
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});

    // bcrypt 함수들의 기본 동작 정의
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_password');
    (bcrypt.hashSync as jest.Mock).mockReturnValue('hashed_password'); // 추가
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('정의되어 있어야 함', () => {
    expect(validatorService).toBeDefined();
  });

  describe('방 생성자 검증', () => {
    let room: Room;
    let user: User;

    beforeEach(() => {
      user = createUserEntity();
      room = createRoomEntity({ creator: user });
    });

    it('사용자가 방 생성자일 때 예외가 발생하지 않아야 함', () => {
      expect(() =>
        validatorService.validateRoomCreator(room, user.id),
      ).not.toThrow();
    });

    it('사용자가 방 생성자가 아닐 때 ForbiddenException이 발생해야 함', () => {
      const otherUser = createUserEntity({ id: 999 });
      expect(() =>
        validatorService.validateRoomCreator(room, otherUser.id),
      ).toThrow(ForbiddenException);
      expect(() =>
        validatorService.validateRoomCreator(room, otherUser.id),
      ).toThrow(ROOM_ERRORS.NOT_ROOM_CREATOR);
    });

    it('방에 생성자가 없을 때 ForbiddenException이 발생해야 함', () => {
      const roomWithoutCreator = createRoomEntity({ creator: null });
      expect(() =>
        validatorService.validateRoomCreator(roomWithoutCreator, user.id),
      ).toThrow(ForbiddenException);
      expect(() =>
        validatorService.validateRoomCreator(roomWithoutCreator, user.id),
      ).toThrow(ROOM_ERRORS.NOT_ROOM_CREATOR);
    });
  });

  describe('방 이전 검증', () => {
    let room: Room;
    let creator: User;
    let newCreator: User;
    let nonParticipant: User;

    beforeEach(() => {
      creator = createUserEntity();
      newCreator = createUserEntity({ id: 2 });
      nonParticipant = createUserEntity({ id: 3 });
      room = createRoomEntity({ creator });
    });

    it('이전이 유효할 때 예외가 발생하지 않아야 함', async () => {
      const participant = createParticipantEntity({ user: newCreator });
      jest
        .spyOn(roomParticipantService, 'getParticipant')
        .mockResolvedValue(participant);

      await expect(
        validatorService.validateRoomTransfer(room, creator.id, newCreator.id),
      ).resolves.not.toThrow();
    });

    it('자신에게 이전할 때 BadRequestException이 발생해야 함', async () => {
      await expect(
        validatorService.validateRoomTransfer(room, creator.id, creator.id),
      ).rejects.toThrow(BadRequestException);
      await expect(
        validatorService.validateRoomTransfer(room, creator.id, creator.id),
      ).rejects.toThrow(ROOM_ERRORS.CANNOT_TRANSFER_TO_SELF);
    });

    it('새로운 생성자가 방에 없을 때 BadRequestException이 발생해야 함', async () => {
      jest
        .spyOn(roomParticipantService, 'getParticipant')
        .mockResolvedValue(null);

      await expect(
        validatorService.validateRoomTransfer(
          room,
          creator.id,
          nonParticipant.id,
        ),
      ).rejects.toThrow(BadRequestException);
      await expect(
        validatorService.validateRoomTransfer(
          room,
          creator.id,
          nonParticipant.id,
        ),
      ).rejects.toThrow(ROOM_ERRORS.TARGET_NOT_IN_ROOM);
    });

    it('현재 사용자가 생성자가 아닐 때 ForbiddenException이 발생해야 함', async () => {
      const nonCreator = createUserEntity({ id: 999 });

      await expect(
        validatorService.validateRoomTransfer(
          room,
          nonCreator.id,
          newCreator.id,
        ),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        validatorService.validateRoomTransfer(
          room,
          nonCreator.id,
          newCreator.id,
        ),
      ).rejects.toThrow(ROOM_ERRORS.NOT_ROOM_CREATOR);
    });
  });

  describe('역할 변경 검증', () => {
    let room: Room;
    let creator: User;
    let targetUser: User;
    let nonParticipant: User;

    beforeEach(() => {
      creator = createUserEntity();
      targetUser = createUserEntity({ id: 2 });
      nonParticipant = createUserEntity({ id: 3 });
      room = createRoomEntity({ creator });
    });

    it('역할 변경이 유효할 때 예외가 발생하지 않아야 함', async () => {
      const participant = createParticipantEntity({ user: targetUser });
      jest
        .spyOn(roomParticipantService, 'getParticipant')
        .mockResolvedValue(participant);

      await expect(
        validatorService.validateRoleChange(
          room,
          creator.id,
          targetUser.id,
          ParticipantRole.GM,
        ),
      ).resolves.not.toThrow();
    });

    it('잘못된 역할일 때 BadRequestException이 발생해야 함', async () => {
      const participant = createParticipantEntity({ user: targetUser });
      jest
        .spyOn(roomParticipantService, 'getParticipant')
        .mockResolvedValue(participant);

      // 수정: 예외 메시지 정확하게 검증
      await expect(
        validatorService.validateRoleChange(
          room,
          creator.id,
          targetUser.id,
          'INVALID_ROLE' as ParticipantRole,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        validatorService.validateRoleChange(
          room,
          creator.id,
          targetUser.id,
          'INVALID_ROLE' as ParticipantRole,
        ),
      ).rejects.toThrow(new RegExp(ROOM_ERRORS.INVALID_PARTICIPANT_ROLE));
    });

    it('대상 사용자가 방에 없을 때 BadRequestException이 발생해야 함', async () => {
      jest
        .spyOn(roomParticipantService, 'getParticipant')
        .mockResolvedValue(null);

      await expect(
        validatorService.validateRoleChange(
          room,
          creator.id,
          nonParticipant.id,
          ParticipantRole.GM,
        ),
      ).rejects.toThrow(BadRequestException);
      await expect(
        validatorService.validateRoleChange(
          room,
          creator.id,
          nonParticipant.id,
          ParticipantRole.GM,
        ),
      ).rejects.toThrow(ROOM_ERRORS.TARGET_NOT_IN_ROOM);
    });

    it('현재 사용자가 생성자가 아닐 때 ForbiddenException이 발생해야 함', async () => {
      const nonCreator = createUserEntity({ id: 999 });
      const participant = createParticipantEntity({ user: targetUser });
      jest
        .spyOn(roomParticipantService, 'getParticipant')
        .mockResolvedValue(participant);

      await expect(
        validatorService.validateRoleChange(
          room,
          nonCreator.id,
          targetUser.id,
          ParticipantRole.GM,
        ),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        validatorService.validateRoleChange(
          room,
          nonCreator.id,
          targetUser.id,
          ParticipantRole.GM,
        ),
      ).rejects.toThrow(ROOM_ERRORS.NOT_ROOM_CREATOR);
    });
  });

  describe('단일 방 참여 검증', () => {
    const userId = 1;

    it('사용자가 어떤 방에도 없을 때 예외가 발생하지 않아야 함', async () => {
      jest.spyOn(roomParticipantRepository, 'count').mockResolvedValue(0);

      await expect(
        validatorService.validateSingleRoomParticipation(userId),
      ).resolves.not.toThrow();
    });

    it('사용자가 이미 방에 있을 때 BadRequestException이 발생해야 함', async () => {
      jest.spyOn(roomParticipantRepository, 'count').mockResolvedValue(1);

      await expect(
        validatorService.validateSingleRoomParticipation(userId),
      ).rejects.toThrow(BadRequestException);
      await expect(
        validatorService.validateSingleRoomParticipation(userId),
      ).rejects.toThrow(ROOM_ERRORS.ALREADY_IN_ROOM);
    });
  });

  describe('방 비밀번호 검증', () => {
    let room: Room;
    const password = '123';

    beforeEach(() => {
      room = createRoomEntity();
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    });
    it('비밀번호가 유효할 때 예외가 발생하지 않아야 함', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      await expect(
        validatorService.validateRoomPassword(room, password),
      ).resolves.not.toThrow();
    });

    it('방 비밀번호가 설정되지 않았을 때 BadRequestException이 발생해야 함', async () => {
      const roomWithoutPassword = createRoomEntity({ password: null });
      await expect(
        validatorService.validateRoomPassword(roomWithoutPassword, password),
      ).rejects.toThrow(BadRequestException);
      await expect(
        validatorService.validateRoomPassword(roomWithoutPassword, password),
      ).rejects.toThrow(ROOM_ERRORS.PASSWORD_REQUIRED);
    });

    it('제공된 비밀번호가 비어 있을 때 BadRequestException이 발생해야 함', async () => {
      await expect(
        validatorService.validateRoomPassword(room, ''),
      ).rejects.toThrow(BadRequestException);
      await expect(
        validatorService.validateRoomPassword(room, ''),
      ).rejects.toThrow(ROOM_ERRORS.PASSWORD_REQUIRED);
    });

    it('비밀번호가 일치하지 않을 때 BadRequestException이 발생해야 함', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      await expect(
        validatorService.validateRoomPassword(room, 'wrong_password'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        validatorService.validateRoomPassword(room, 'wrong_password'),
      ).rejects.toThrow(ROOM_ERRORS.PASSWORD_MISMATCH);
    });
  });

  describe('방 수용 인원 검증', () => {
    let room: Room;

    beforeEach(() => {
      room = createRoomEntity({ maxParticipants: 2 });
    });

    it('방에 여유가 있을 때 예외가 발생하지 않아야 함', async () => {
      jest.spyOn(roomParticipantRepository, 'count').mockResolvedValue(1);

      await expect(
        validatorService.validateRoomCapacity(room),
      ).resolves.not.toThrow();
    });

    it('방이 가득 찼을 때 BadRequestException이 발생해야 함', async () => {
      jest.spyOn(roomParticipantRepository, 'count').mockResolvedValue(2);

      await expect(validatorService.validateRoomCapacity(room)).rejects.toThrow(
        BadRequestException,
      );
      await expect(validatorService.validateRoomCapacity(room)).rejects.toThrow(
        ROOM_ERRORS.ROOM_FULL,
      );
    });
  });

  describe('방 생성 검증', () => {
    const userId = 1;

    it('사용자가 어떤 방에도 없을 때 예외가 발생하지 않아야 함', async () => {
      jest.spyOn(roomParticipantRepository, 'count').mockResolvedValue(0);

      await expect(
        validatorService.validateRoomCreation(userId),
      ).resolves.not.toThrow();
    });

    it('사용자가 이미 방에 있을 때 ConflictException이 발생해야 함', async () => {
      jest.spyOn(roomParticipantRepository, 'count').mockResolvedValue(1);

      await expect(
        validatorService.validateRoomCreation(userId),
      ).rejects.toThrow(ConflictException);
      await expect(
        validatorService.validateRoomCreation(userId),
      ).rejects.toThrow(ROOM_ERRORS.ALREADY_IN_ROOM);
    });
  });

  describe('방 참가 검증', () => {
    let room: Room;
    const userId = 1;
    const password = '123';

    beforeEach(() => {
      room = createRoomEntity({ maxParticipants: 2 });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    });

    it('모든 검증이 통과할 때 예외가 발생하지 않아야 함', async () => {
      jest
        .spyOn(roomParticipantRepository, 'count')
        .mockResolvedValueOnce(0) // validateSingleRoomParticipation
        .mockResolvedValueOnce(1); // validateRoomCapacity

      await expect(
        validatorService.validateRoomJoin(room, userId, password),
      ).resolves.not.toThrow();
    });

    it('사용자가 이미 방에 있을 때 BadRequestException이 발생해야 함', async () => {
      jest.spyOn(roomParticipantRepository, 'count').mockResolvedValue(1);

      await expect(
        validatorService.validateRoomJoin(room, userId, password),
      ).rejects.toThrow(BadRequestException);
      await expect(
        validatorService.validateRoomJoin(room, userId, password),
      ).rejects.toThrow(ROOM_ERRORS.ALREADY_IN_ROOM);
    });

    it('비밀번호가 유효하지 않을 때 BadRequestException이 발생해야 함', async () => {
      jest.spyOn(roomParticipantRepository, 'count').mockResolvedValue(0);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        validatorService.validateRoomJoin(room, userId, 'wrong_password'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        validatorService.validateRoomJoin(room, userId, 'wrong_password'),
      ).rejects.toThrow(ROOM_ERRORS.PASSWORD_MISMATCH);
    });

    it('방이 가득 찼을 때 BadRequestException이 발생해야 함', async () => {
      // validateSingleRoomParticipation에서 (사용자가 다른 방에 없는지 확인)
      // validateRoomCapacity에서 (방이 꽉 찼는지 확인)
      const countSpy = jest
        .spyOn(roomParticipantRepository, 'count')
        .mockResolvedValueOnce(0) // 첫 번째 호출: 사용자가 다른 방에 없음
        .mockResolvedValueOnce(2); // 두 번째 호출: 방이 꽉 찼음

      await expect(
        validatorService.validateRoomJoin(room, userId, password),
      ).rejects.toThrow(ROOM_ERRORS.ROOM_FULL);

      expect(countSpy).toHaveBeenCalledTimes(2);
    });
  });
});
