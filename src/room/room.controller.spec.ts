import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ExecutionContext,
  ForbiddenException,
  INestApplication,
  NotFoundException,
} from '@nestjs/common';
import * as request from 'supertest';
import { RoomController } from './room.controller';
import { RoomService } from './room.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { JoinRoomDto } from './dto/join-room.dto';
import { RoomResponseDto } from './dto/room-response.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RoomParticipantDto } from './dto/room-participant.dto';
import { ParticipantRole } from '@/common/enums/participant-role.enum';
import { v4 as uuidv4 } from 'uuid';

describe('RoomController', () => {
  let app: INestApplication;
  let roomService: RoomService;

  const mockUser = {
    id: 1,
    email: 'test@example.com',
    role: 'USER',
  };

  const mockRoomResponse: RoomResponseDto = {
    id: uuidv4(),
    name: 'Test Room',
    maxParticipants: 2,
    currentParticipants: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    isDeleted: false,
    participants: [
      {
        id: 1,
        name: 'Test User',
        nickname: 'testuser',
        role: ParticipantRole.PLAYER,
      } as RoomParticipantDto,
    ],
  };

  const mockRoomOperationResponse = {
    message: '방이 성공적으로 생성되었습니다.',
    room: mockRoomResponse,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RoomController],
      providers: [
        {
          provide: RoomService,
          useValue: {
            createRoom: jest.fn(),
            joinRoom: jest.fn(),
            leaveRoom: jest.fn(),
            deleteRoom: jest.fn(),
            getRoomWithParticipants: jest.fn(),
            transferCreator: jest.fn(),
            updateParticipantRole: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          req.user = { ...mockUser };
          return true;
        },
      })
      .compile();

    app = module.createNestApplication();
    roomService = module.get<RoomService>(RoomService);
    await app.init();
  });

  afterEach(async () => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /rooms', () => {
    it('should create a room', async () => {
      const createRoomDto: CreateRoomDto = {
        name: 'Test Room',
        password: '123',
      };

      jest
        .spyOn(roomService, 'createRoom')
        .mockResolvedValue(mockRoomOperationResponse);

      const response = await request(app.getHttpServer())
        .post('/rooms')
        .send(createRoomDto)
        .expect(201);

      expect(response.body).toEqual({
        message: mockRoomOperationResponse.message,
        room: {
          ...mockRoomResponse,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
      });
      expect(roomService.createRoom).toHaveBeenCalledWith(createRoomDto, 1);
    });

    it('should return 400 for invalid input', async () => {
      const invalidRoomDto = {
        name: '',
        password: '123',
      };

      jest
        .spyOn(roomService, 'createRoom')
        .mockRejectedValue(
          new BadRequestException('방 이름은 1~50자여야 합니다.'),
        );

      const response = await request(app.getHttpServer())
        .post('/rooms')
        .send(invalidRoomDto)
        .expect(400);

      expect(response.body.statusCode).toBe(400);
    });

    it('should return 409 when user is already in another room', async () => {
      const createRoomDto: CreateRoomDto = {
        name: 'Test Room',
        password: '123',
      };

      jest.spyOn(roomService, 'createRoom').mockRejectedValue(
        new ConflictException({
          message: '이미 방에 참가한 사용자입니다.',
        }),
      );

      await request(app.getHttpServer())
        .post('/rooms')
        .send(createRoomDto)
        .expect(409);
    });
  });

  describe('POST /rooms/:roomId/join', () => {
    it('should join a room successfully', async () => {
      const roomId = uuidv4();
      const joinRoomDto: JoinRoomDto = { password: '123' };

      jest
        .spyOn(roomService, 'joinRoom')
        .mockResolvedValue(mockRoomOperationResponse);

      const response = await request(app.getHttpServer())
        .post(`/rooms/${roomId}/join`)
        .send(joinRoomDto)
        .expect(200);

      expect(response.body).toEqual({
        message: mockRoomOperationResponse.message,
        room: {
          ...mockRoomResponse,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
      });
      expect(roomService.joinRoom).toHaveBeenCalledWith(roomId, 1, joinRoomDto);
    });

    it('should return 400 for password mismatch', async () => {
      const roomId = uuidv4();
      const joinRoomDto: JoinRoomDto = { password: 'wrong' };

      jest.spyOn(roomService, 'joinRoom').mockRejectedValue(
        new BadRequestException({
          message: '비밀번호가 일치하지 않습니다.',
        }),
      );

      const response = await request(app.getHttpServer())
        .post(`/rooms/${roomId}/join`)
        .send(joinRoomDto)
        .expect(400);

      expect(response.body.message).toBe('비밀번호가 일치하지 않습니다.');
    });

    it('should return 400 for missing password', async () => {
      const roomId = uuidv4();
      const joinRoomDto: JoinRoomDto = { password: '' };

      jest.spyOn(roomService, 'joinRoom').mockRejectedValue(
        new BadRequestException({
          message: '비밀번호를 입력해주세요.',
        }),
      );

      const response = await request(app.getHttpServer())
        .post(`/rooms/${roomId}/join`)
        .send(joinRoomDto)
        .expect(400);

      expect(response.body.message).toBe('비밀번호를 입력해주세요.');
    });

    it('should return 400 for full room', async () => {
      const roomId = uuidv4();
      const joinRoomDto: JoinRoomDto = { password: '123' };

      jest.spyOn(roomService, 'joinRoom').mockRejectedValue(
        new BadRequestException({
          message: '방이 꽉 찼습니다.',
        }),
      );

      const response = await request(app.getHttpServer())
        .post(`/rooms/${roomId}/join`)
        .send(joinRoomDto)
        .expect(400);

      expect(response.body.message).toBe('방이 꽉 찼습니다.');
    });

    it('should return 404 for non-existent room', async () => {
      const roomId = uuidv4();
      const joinRoomDto: JoinRoomDto = { password: '123' };

      jest.spyOn(roomService, 'joinRoom').mockRejectedValue(
        new NotFoundException({
          message: '방을 찾을 수 없습니다.',
        }),
      );

      await request(app.getHttpServer())
        .post(`/rooms/${roomId}/join`)
        .send(joinRoomDto)
        .expect(404);
    });
  });

  describe('POST /rooms/:roomId/leave', () => {
    it('should leave room successfully', async () => {
      const roomId = uuidv4();

      await request(app.getHttpServer())
        .post(`/rooms/${roomId}/leave`)
        .expect(204);

      expect(roomService.leaveRoom).toHaveBeenCalledWith(1, roomId);
    });

    it('should handle idempotency', async () => {
      const roomId = uuidv4();

      // First call
      await request(app.getHttpServer())
        .post(`/rooms/${roomId}/leave`)
        .expect(204);

      // Second call (should still return 204)
      await request(app.getHttpServer())
        .post(`/rooms/${roomId}/leave`)
        .expect(204);
    });

    it('should return 403 when user is creator', async () => {
      const roomId = uuidv4();

      jest.spyOn(roomService, 'leaveRoom').mockRejectedValue(
        new ForbiddenException({
          message:
            '방장은 방을 나갈 수 없습니다. 방을 나가려면 방 삭제 또는 방장 위임을 하세요.',
        }),
      );

      const response = await request(app.getHttpServer())
        .post(`/rooms/${roomId}/leave`)
        .expect(403);

      expect(response.body.message).toBe(
        '방장은 방을 나갈 수 없습니다. 방을 나가려면 방 삭제 또는 방장 위임을 하세요.',
      );
    });
  });

  describe('DELETE /rooms/:roomId', () => {
    it('should delete room successfully', async () => {
      const roomId = uuidv4();

      await request(app.getHttpServer()).delete(`/rooms/${roomId}`).expect(204);

      expect(roomService.deleteRoom).toHaveBeenCalledWith(roomId, 1);
    });

    it('should return 403 when user is not creator', async () => {
      const roomId = uuidv4();

      jest.spyOn(roomService, 'deleteRoom').mockRejectedValue(
        new ForbiddenException({
          message: '방장만이 이 작업을 수행할 수 있습니다.',
        }),
      );

      await request(app.getHttpServer()).delete(`/rooms/${roomId}`).expect(403);
    });

    it('should handle idempotency', async () => {
      const roomId = uuidv4();

      // First call
      await request(app.getHttpServer()).delete(`/rooms/${roomId}`).expect(204);

      // Second call (should still return 204)
      await request(app.getHttpServer()).delete(`/rooms/${roomId}`).expect(204);
    });
  });

  describe('GET /rooms/:roomId', () => {
    it('should get room details', async () => {
      const roomId = uuidv4();
      jest
        .spyOn(roomService, 'getRoomWithParticipants')
        .mockResolvedValue(mockRoomResponse);

      const response = await request(app.getHttpServer())
        .get(`/rooms/${roomId}`)
        .expect(200);

      expect(response.body).toEqual({
        ...mockRoomResponse,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
      expect(roomService.getRoomWithParticipants).toHaveBeenCalledWith(roomId);
    });

    it('should return 404 for non-existent room', async () => {
      const roomId = uuidv4();
      jest.spyOn(roomService, 'getRoomWithParticipants').mockRejectedValue(
        new NotFoundException({
          message: '방을 찾을 수 없습니다.',
        }),
      );

      await request(app.getHttpServer()).get(`/rooms/${roomId}`).expect(404);
    });
  });

  describe('PATCH /rooms/:roomId/transfer-creator', () => {
    it('should transfer creator role successfully', async () => {
      const roomId = uuidv4();
      const newCreatorId = 2; // 다른 사용자 ID
      const dto = { newCreatorId };

      jest
        .spyOn(roomService, 'transferCreator')
        .mockResolvedValue(mockRoomOperationResponse);

      const response = await request(app.getHttpServer())
        .patch(`/rooms/${roomId}/transfer-creator`)
        .send(dto)
        .expect(200);

      expect(response.body).toEqual({
        message: mockRoomOperationResponse.message,
        room: {
          ...mockRoomResponse,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
      });
      expect(roomService.transferCreator).toHaveBeenCalledWith(
        roomId,
        mockUser.id,
        newCreatorId,
      );
    });

    it('should return 403 when user is not creator', async () => {
      const roomId = uuidv4();
      const dto = { newCreatorId: 2 };

      jest.spyOn(roomService, 'transferCreator').mockRejectedValue(
        new ForbiddenException({
          message: '방장만이 이 작업을 수행할 수 있습니다.',
        }),
      );

      await request(app.getHttpServer())
        .patch(`/rooms/${roomId}/transfer-creator`)
        .send(dto)
        .expect(403);
    });

    it('should return 400 when new creator is not in room', async () => {
      const roomId = uuidv4();
      const dto = { newCreatorId: 999 }; // 존재하지 않는 사용자

      jest.spyOn(roomService, 'transferCreator').mockRejectedValue(
        new BadRequestException({
          message: '대상 사용자가 방에 참가하지 않았습니다.',
        }),
      );

      const response = await request(app.getHttpServer())
        .patch(`/rooms/${roomId}/transfer-creator`)
        .send(dto)
        .expect(400);

      expect(response.body.message).toBe(
        '대상 사용자가 방에 참가하지 않았습니다.',
      );
    });

    it('should return 400 when transferring to self', async () => {
      const roomId = uuidv4();
      const dto = { newCreatorId: 1 }; // 자기 자신

      jest.spyOn(roomService, 'transferCreator').mockRejectedValue(
        new BadRequestException({
          message: '자신에게 방장 권한을 위임할 수 없습니다.',
        }),
      );

      const response = await request(app.getHttpServer())
        .patch(`/rooms/${roomId}/transfer-creator`)
        .send(dto)
        .expect(400);

      expect(response.body.message).toBe(
        '자신에게 방장 권한을 위임할 수 없습니다.',
      );
    });
  });

  describe('PATCH /rooms/:roomId/participants/:userId/role', () => {
    it('should update participant role successfully', async () => {
      const roomId = uuidv4();
      const userId = 2; // 대상 사용자 ID
      const role = ParticipantRole.PLAYER;
      const dto = { role };

      jest
        .spyOn(roomService, 'updateParticipantRole')
        .mockResolvedValue(mockRoomOperationResponse);

      const response = await request(app.getHttpServer())
        .patch(`/rooms/${roomId}/participants/${userId}/role`)
        .send(dto)
        .expect(200);

      expect(response.body).toEqual({
        message: mockRoomOperationResponse.message,
        room: {
          ...mockRoomResponse,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
      });
      expect(roomService.updateParticipantRole).toHaveBeenCalledWith(
        roomId,
        mockUser.id,
        userId,
        role,
      );
    });

    it('should return 403 when user is not creator', async () => {
      const roomId = uuidv4();
      const userId = 2;
      const dto = { role: ParticipantRole.PLAYER };

      jest.spyOn(roomService, 'updateParticipantRole').mockRejectedValue(
        new ForbiddenException({
          message: '방장만이 이 작업을 수행할 수 있습니다.',
        }),
      );

      await request(app.getHttpServer())
        .patch(`/rooms/${roomId}/participants/${userId}/role`)
        .send(dto)
        .expect(403);
    });

    it('should return 400 when participant is not in room', async () => {
      const roomId = uuidv4();
      const userId = 999; // 존재하지 않는 사용자
      const dto = { role: ParticipantRole.PLAYER };

      jest.spyOn(roomService, 'updateParticipantRole').mockRejectedValue(
        new BadRequestException({
          message: '대상 사용자가 방에 참가하지 않았습니다.',
        }),
      );

      const response = await request(app.getHttpServer())
        .patch(`/rooms/${roomId}/participants/${userId}/role`)
        .send(dto)
        .expect(400);

      expect(response.body.message).toBe(
        '대상 사용자가 방에 참가하지 않았습니다.',
      );
    });

    it('should return 400 for invalid role', async () => {
      const roomId = uuidv4();
      const userId = 2;
      const invalidRole = 'INVALID_ROLE';
      const dto = { role: invalidRole };

      jest.spyOn(roomService, 'updateParticipantRole').mockRejectedValue(
        new BadRequestException({
          message: '유효하지 않은 참여자 역할입니다.',
        }),
      );

      const response = await request(app.getHttpServer())
        .patch(`/rooms/${roomId}/participants/${userId}/role`)
        .send(dto)
        .expect(400);

      expect(response.body.message).toBe('유효하지 않은 참여자 역할입니다.');
    });
  });
});
