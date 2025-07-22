import { Test, TestingModule } from '@nestjs/testing';
import { RoomController } from './room.controller';
import { RoomService } from './room.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { JoinRoomDto } from './dto/join-room.dto';
import { User } from '@/users/entities/user.entity';
import { UserRole } from '@/users/entities/user-role.enum';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('RoomController', () => {
  let controller: RoomController;
  let roomService: jest.Mocked<RoomService>;

  const mockUser = {
    id: 1,
    role: UserRole.USER,
  } as User;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [RoomController],
      providers: [
        {
          provide: RoomService,
          useValue: {
            createRoom: jest.fn(),
            joinRoom: jest.fn(),
            getParticipants: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = moduleRef.get<RoomController>(RoomController);
    roomService = moduleRef.get(RoomService);
  });

  describe('createRoom', () => {
    const createRoomDto: CreateRoomDto = {
      name: 'TestRoom',
      password: '1234',
      maxParticipants: 2,
    };

    it('should call roomService.createRoom with valid DTO', async () => {
      const req = { user: mockUser };
      await controller.createRoom(createRoomDto, req as any);
      expect(roomService.createRoom).toHaveBeenCalledWith(createRoomDto, mockUser.id);
    });

    it('should throw BadRequestException if service fails', async () => {
      const errorMessage = '방 생성 실패';
      jest.spyOn(roomService, 'createRoom').mockRejectedValue(new BadRequestException(errorMessage))
      await expect(controller.createRoom(createRoomDto, { user: mockUser }))
        .rejects
        .toThrow(BadRequestException);
    });
  });

  describe('joinRoom', () => {
    const roomId = 1;
    const validPassword = '1234';

    it('should call roomService.joinRoom with valid password', async () => {
      await controller.joinRoom(roomId, { user: mockUser } as any, validPassword);
      expect(roomService.joinRoom).toHaveBeenCalledWith(roomId, mockUser.id, validPassword);
    });

    it('should throw BadRequestException if password is missing', async () => {
      const invalidDto = { password: undefined } as any;
      jest.spyOn(roomService, 'joinRoom').mockRejectedValue(new BadRequestException())
      await expect(controller.joinRoom(roomId, { user: mockUser } as any, invalidDto))
        .rejects
        .toThrow(BadRequestException);
    });

    it('should throw BadRequestException if service fails', async () => {
      const errorMessage = '방 참여 실패';
      roomService.joinRoom.mockRejectedValue(new BadRequestException(errorMessage));
      await expect(controller.joinRoom(roomId, { user: mockUser } as any, validPassword))
        .rejects
        .toThrow(BadRequestException);
    });
  });

  describe('getParticipants', () => {
    const roomId = 1;

    it('should call roomService.getParticipants', async () => {
      await controller.getParticipants(roomId);
      expect(roomService.getParticipants).toHaveBeenCalledWith(roomId);
    });

    it('should throw NotFoundException if room does not exist', async () => {
      roomService.getParticipants.mockRejectedValue(new NotFoundException('방을 찾을 수 없습니다.'));
      await expect(controller.getParticipants(roomId))
        .rejects
        .toThrow(NotFoundException);
    });
  });
});