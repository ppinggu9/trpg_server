import { Test, TestingModule } from '@nestjs/testing';
import { RoomParticipantService } from './room-participant.service';
import { Repository } from 'typeorm';
import { RoomParticipant } from './entities/room-participant.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Room } from './entities/room.entity';
import { User } from '@/users/entities/user.entity';
import { ParticipantRole } from '@/common/enums/participant-role.enum';
import { ROOM_PARTICIPANT_ERRORS } from './constants/room.constants';
import { createRoomEntity } from './factory/room.factory';
import { createUserEntity } from '@/users/factory/user.factory';
import { createParticipantEntity } from './factory/room.factory';

describe('방 참가자 서비스', () => {
  let service: RoomParticipantService;
  let repository: Repository<RoomParticipant>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoomParticipantService,
        {
          provide: getRepositoryToken(RoomParticipant),
          useClass: Repository,
        },
      ],
    }).compile();

    service = module.get<RoomParticipantService>(RoomParticipantService);
    repository = module.get<Repository<RoomParticipant>>(
      getRepositoryToken(RoomParticipant),
    );
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('정의되어 있어야 함', () => {
    expect(service).toBeDefined();
  });

  describe('참가자 추가', () => {
    let room: Room;
    let user: User;

    beforeEach(() => {
      room = createRoomEntity();
      user = createUserEntity();
    });

    it('방에 참가자 추가가 성공적으로 이루어져야 함', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);
      jest.spyOn(repository, 'create').mockReturnValue({
        room,
        user,
        role: ParticipantRole.PLAYER,
      } as RoomParticipant);
      jest.spyOn(repository, 'save').mockResolvedValue({} as RoomParticipant);

      await service.addParticipant(room, user);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: {
          room: { id: room.id },
          user: { id: user.id },
          leftAt: null,
        },
      });
      expect(repository.create).toHaveBeenCalledWith({
        room,
        user,
        role: ParticipantRole.PLAYER,
      });
      expect(repository.save).toHaveBeenCalled();
    });

    it('참가자가 이미 방에 있을 때 BadRequestException이 발생해야 함', async () => {
      const existingParticipant = createParticipantEntity();
      jest.spyOn(repository, 'findOne').mockResolvedValue(existingParticipant);

      await expect(service.addParticipant(room, user)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.addParticipant(room, user)).rejects.toThrow(
        ROOM_PARTICIPANT_ERRORS.ALREADY_PARTICIPATING,
      );
    });
  });

  describe('방 나가기', () => {
    const userId = 1;
    const roomId = 'room-123';

    it('참가 기록이 존재할 때 방 나가기가 성공적으로 이루어져야 함', async () => {
      const participation = createParticipantEntity();
      jest.spyOn(repository, 'findOne').mockResolvedValue(participation);
      jest.spyOn(repository, 'softDelete').mockResolvedValue({} as any);

      await service.leaveRoom(userId, roomId);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { user: { id: userId }, room: { id: roomId } },
        withDeleted: true,
      });
      expect(repository.softDelete).toHaveBeenCalledWith(participation.id);
    });

    it('참가 기록이 없을 때 (멱등성) 처리해야 함', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);
      const softDeleteSpy = jest.spyOn(repository, 'softDelete'); // spy 등록

      await expect(service.leaveRoom(userId, roomId)).resolves.not.toThrow();

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { user: { id: userId }, room: { id: roomId } },
        withDeleted: true,
      });
      expect(softDeleteSpy).not.toHaveBeenCalled(); // spy 객체 검증
    });

    it('참가자가 이미 나간 상태일 때 (멱등성) 처리해야 함', async () => {
      const leftParticipation = createParticipantEntity({
        leftAt: new Date(),
      });
      jest.spyOn(repository, 'findOne').mockResolvedValue(leftParticipation);
      const softDeleteSpy = jest.spyOn(repository, 'softDelete');

      await expect(service.leaveRoom(userId, roomId)).resolves.not.toThrow();
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { user: { id: userId }, room: { id: roomId } },
        withDeleted: true,
      });
      expect(softDeleteSpy).not.toHaveBeenCalled();
    });
  });

  describe('사용자 ID로 모든 방 나가기', () => {
    const userId = 1;

    it('모든 방 나가기가 성공적으로 이루어져야 함', async () => {
      const participations = [
        createParticipantEntity({ id: 1 }),
        createParticipantEntity({ id: 2 }),
      ];
      jest.spyOn(repository, 'find').mockResolvedValue(participations);
      jest.spyOn(repository, 'softDelete').mockResolvedValue({
        raw: [],
        affected: 2,
      } as any);

      const result = await service.leaveAllRoomsByUserId(userId);

      expect(repository.find).toHaveBeenCalledWith({
        where: { user: { id: userId } },
      });
      expect(repository.softDelete).toHaveBeenCalledWith([1, 2]);
      expect(result).toEqual({ raw: [], affected: 2 });
    });

    it('참가 기록이 없을 때 (멱등성) 처리해야 함', async () => {
      jest.spyOn(repository, 'find').mockResolvedValue([]);
      const softDeleteSpy = jest.spyOn(repository, 'softDelete');

      const result = await service.leaveAllRoomsByUserId(userId);

      expect(repository.find).toHaveBeenCalledWith({
        where: { user: { id: userId } },
      });
      expect(softDeleteSpy).not.toHaveBeenCalled();
      expect(result).toEqual({ raw: [], affected: 0 });
    });
  });

  describe('방에서 모든 사용자 나가기', () => {
    const roomId = 'room-123';

    it('방에서 모든 참가자 제거가 성공적으로 이루어져야 함', async () => {
      const participations = [
        createParticipantEntity({ id: 1 }),
        createParticipantEntity({ id: 2 }),
      ];
      jest.spyOn(repository, 'find').mockResolvedValue(participations);
      jest.spyOn(repository, 'softDelete').mockResolvedValue({} as any);

      await service.leaveAllUsersFromRoom(roomId);

      expect(repository.find).toHaveBeenCalledWith({
        where: { room: { id: roomId } },
      });
      expect(repository.softDelete).toHaveBeenCalledWith([1, 2]);
    });

    it('참가자가 없을 때 (멱등성) 처리해야 함', async () => {
      jest.spyOn(repository, 'find').mockResolvedValue([]);
      const softDeleteSpy = jest.spyOn(repository, 'softDelete');

      await expect(
        service.leaveAllUsersFromRoom(roomId),
      ).resolves.not.toThrow();
      expect(repository.find).toHaveBeenCalledWith({
        where: { room: { id: roomId } },
      });
      expect(softDeleteSpy).not.toHaveBeenCalled();
    });
  });

  describe('활성 참가자 목록 조회', () => {
    const roomId = 'room-123';

    it('활성 참가자 목록을 반환해야 함', async () => {
      const participants = [
        createParticipantEntity({
          user: createUserEntity({ id: 1, name: 'User 1', nickname: 'nick1' }),
          role: ParticipantRole.GM,
        }),
        createParticipantEntity({
          user: createUserEntity({ id: 2, name: 'User 2', nickname: 'nick2' }),
          role: ParticipantRole.PLAYER,
        }),
      ];
      jest.spyOn(repository, 'find').mockResolvedValue(participants);

      const result = await service.getActiveParticipants(roomId);

      expect(repository.find).toHaveBeenCalledWith({
        where: { room: { id: roomId } },
        relations: { user: true },
        select: {
          user: {
            id: true,
            nickname: true,
            name: true,
          },
        },
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 1,
        name: 'User 1',
        nickname: 'nick1',
        role: ParticipantRole.GM,
      });
      expect(result[1]).toEqual({
        id: 2,
        name: 'User 2',
        nickname: 'nick2',
        role: ParticipantRole.PLAYER,
      });
    });
  });

  describe('활성 참가자 수 조회', () => {
    const roomId = 'room-123';

    it('올바른 활성 참가자 수를 반환해야 함', async () => {
      jest.spyOn(repository, 'count').mockResolvedValue(3);

      const count = await service.getActiveParticipantsCount(roomId);

      expect(repository.count).toHaveBeenCalledWith({
        where: { room: { id: roomId }, leftAt: null },
      });
      expect(count).toBe(3);
    });
  });

  describe('참가자 조회', () => {
    const roomId = 'room-123';
    const userId = 1;

    it('참가자가 존재할 때 참가자를 반환해야 함', async () => {
      const participant = createParticipantEntity();
      jest.spyOn(repository, 'findOne').mockResolvedValue(participant);

      const result = await service.getParticipant(roomId, userId);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { room: { id: roomId }, user: { id: userId } },
      });
      expect(result).toBe(participant);
    });

    it('참가자가 존재하지 않을 때 null을 반환해야 함', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);

      const result = await service.getParticipant(roomId, userId);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { room: { id: roomId }, user: { id: userId } },
      });
      expect(result).toBeNull();
    });
  });

  describe('참가자 역할 업데이트', () => {
    const participantId = 1;
    const newRole = ParticipantRole.GM;

    it('참가자 역할 업데이트가 성공적으로 이루어져야 함', async () => {
      const participant = createParticipantEntity();
      jest.spyOn(repository, 'findOne').mockResolvedValue(participant);
      jest.spyOn(repository, 'save').mockResolvedValue(participant);

      await service.updateParticipantRole(participantId, newRole);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: participantId },
      });
      expect(participant.role).toBe(newRole);
      expect(repository.save).toHaveBeenCalledWith(participant);
    });

    it('잘못된 역할일 때 BadRequestException이 발생해야 함', async () => {
      const invalidRole = 'INVALID_ROLE' as ParticipantRole;
      jest
        .spyOn(repository, 'findOne')
        .mockResolvedValue(createParticipantEntity());

      await expect(
        service.updateParticipantRole(participantId, invalidRole),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.updateParticipantRole(participantId, invalidRole),
      ).rejects.toThrow(ROOM_PARTICIPANT_ERRORS.INVALID_PARTICIPANT_ROLE);
    });

    it('참가자가 존재하지 않을 때 NotFoundException이 발생해야 함', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);

      await expect(
        service.updateParticipantRole(participantId, newRole),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.updateParticipantRole(participantId, newRole),
      ).rejects.toThrow(ROOM_PARTICIPANT_ERRORS.PARTICIPANT_NOT_FOUND);
    });
  });
});
