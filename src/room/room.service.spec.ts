// import { Test, TestingModule } from '@nestjs/testing';
// import { RoomService } from './room.service';
// import { Repository } from 'typeorm';
// import { Room } from './entities/room.entity';
// import { getRepositoryToken } from '@nestjs/typeorm';
// import {
//   NotFoundException,
//   ForbiddenException,
//   BadRequestException,
//   ConflictException,
// } from '@nestjs/common';
// import { RoomValidatorService } from './room-validator.service';
// import { RoomParticipantService } from './room-participant.service';
// import { UsersService } from '@/users/users.service';
// import { RoomResponseDto } from './dto/room-response.dto';
// import { ParticipantRole } from '@/common/enums/participant-role.enum';
// import { ROOM_ERRORS, ROOM_MESSAGES } from './constants/room.constants';
// import { createRoomEntity } from './factory/room.factory';
// import { createUserEntity } from '@/users/factory/user.factory';
// import { createParticipantEntity } from './factory/room.factory';
// import * as bcrypt from 'bcryptjs';

// jest.mock('typeorm-transactional', () => ({
//   Transactional: () => () => ({}),
// }));

// jest.mock('bcryptjs', () => ({
//   compare: jest.fn(),
//   hash: jest.fn(),
//   hashSync: jest.fn(),
// }));

// describe('RoomService', () => {
//   let service: RoomService;
//   let roomRepository: jest.Mocked<Repository<Room>>;
//   let usersService: jest.Mocked<UsersService>;
//   let roomParticipantService: jest.Mocked<RoomParticipantService>;
//   let roomValidatorService: jest.Mocked<RoomValidatorService>;
//   let queryBuilder: any;

//   const mockRoom = createRoomEntity();
//   const mockUser = createUserEntity();

//   beforeEach(async () => {
//     // QueryBuilder 모킹 설정
//     queryBuilder = {
//       where: jest.fn().mockReturnThis(),
//       leftJoinAndSelect: jest.fn().mockReturnThis(),
//       getOne: jest.fn(),
//     };

//     const module: TestingModule = await Test.createTestingModule({
//       providers: [
//         RoomService,
//         {
//           provide: getRepositoryToken(Room),
//           useValue: {
//             create: jest.fn(),
//             save: jest.fn(),
//             findOne: jest.fn(),
//             softDelete: jest.fn(),
//             createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
//           },
//         },
//         {
//           provide: UsersService,
//           useValue: {
//             getActiveUserById: jest.fn(),
//             updateUser: jest.fn(),
//           },
//         },
//         {
//           provide: RoomParticipantService,
//           useValue: {
//             addParticipant: jest.fn(),
//             leaveRoom: jest.fn(),
//             leaveAllUsersFromRoom: jest.fn(),
//             updateParticipantRole: jest.fn(),
//             getActiveParticipantsCount: jest.fn(),
//             getParticipant: jest.fn(),
//           },
//         },
//         {
//           provide: RoomValidatorService,
//           useValue: {
//             validateRoomCreation: jest.fn(),
//             validateRoomJoin: jest.fn(),
//             validateRoomTransfer: jest.fn(),
//             validateRoleChange: jest.fn(),
//             validateRoomCreator: jest.fn(),
//             validateRoomCapacity: jest.fn(),
//             validateRoomPassword: jest.fn(),
//             validateSingleRoomParticipation: jest.fn(),
//           },
//         },
//       ],
//     }).compile();

//     service = module.get<RoomService>(RoomService);
//     roomRepository = module.get<jest.Mocked<Repository<Room>>>(
//       getRepositoryToken(Room),
//     );
//     usersService = module.get<jest.Mocked<UsersService>>(UsersService);
//     roomParticipantService = module.get<jest.Mocked<RoomParticipantService>>(
//       RoomParticipantService,
//     );
//     roomValidatorService =
//       module.get<jest.Mocked<RoomValidatorService>>(RoomValidatorService);
//   });

//   beforeEach(() => {
//     jest.clearAllMocks();
//     jest.spyOn(console, 'error').mockImplementation(() => {});

//     // bcrypt 모킹 기본값 설정 강화
//     (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_password');
//     (bcrypt.compare as jest.Mock).mockResolvedValue(true);
//     (bcrypt.hashSync as jest.Mock).mockReturnValue('hashed_password_sync');

//     // QueryBuilder 기본 동작 설정
//     queryBuilder.getOne.mockResolvedValue(mockRoom);
//   });

//   afterEach(() => {
//     jest.restoreAllMocks();
//   });

//   it('should be defined', () => {
//     expect(service).toBeDefined();
//   });

//   describe('createRoom', () => {
//     const creatorId = 1;
//     const createRoomDto = {
//       name: 'Test Room',
//       password: '123',
//       maxParticipants: 2,
//     };

//     it('should create room successfully', async () => {
//       usersService.getActiveUserById.mockResolvedValue(mockUser);
//       roomValidatorService.validateRoomCreation.mockResolvedValue(undefined);
//       roomRepository.create.mockReturnValue(mockRoom);
//       roomRepository.save.mockResolvedValue(mockRoom);
//       roomParticipantService.addParticipant.mockResolvedValue(undefined);

//       const result = await service.createRoom(createRoomDto, creatorId);

//       expect(usersService.getActiveUserById).toHaveBeenCalledWith(creatorId);
//       expect(roomValidatorService.validateRoomCreation).toHaveBeenCalledWith(
//         creatorId,
//       );
//       expect(bcrypt.hash).toHaveBeenCalledWith(createRoomDto.password, 10);
//       expect(roomRepository.create).toHaveBeenCalledWith({
//         name: createRoomDto.name,
//         password: 'hashed_password',
//         maxParticipants: createRoomDto.maxParticipants,
//         creator: mockUser,
//       });
//       expect(roomRepository.save).toHaveBeenCalled();
//       expect(roomParticipantService.addParticipant).toHaveBeenCalledWith(
//         mockRoom,
//         mockUser,
//         ParticipantRole.PLAYER,
//       );
//       expect(result).toEqual({
//         message: ROOM_MESSAGES.CREATED,
//         room: RoomResponseDto.fromEntity(mockRoom),
//       });
//     });

//     it('should throw NotFoundException when user not found', async () => {
//       usersService.getActiveUserById.mockRejectedValue(new NotFoundException());

//       await expect(
//         service.createRoom(createRoomDto, creatorId),
//       ).rejects.toThrow(NotFoundException);
//     });
//   });

//   describe('joinRoom', () => {
//     const roomId = 'room-123';
//     const userId = 1;
//     const joinRoomDto = { password: '123' };

//     it('should join room successfully', async () => {
//       // findActiveRoom에서 사용되는 방 조회
//       queryBuilder.getOne.mockResolvedValue(mockRoom);
//       // joinRoom 내에서 최신 상태의 방 조회
//       roomRepository.findOne.mockResolvedValue(mockRoom);

//       roomValidatorService.validateRoomJoin.mockResolvedValue(undefined);
//       usersService.getActiveUserById.mockResolvedValue(mockUser);
//       roomParticipantService.addParticipant.mockResolvedValue(undefined);

//       const result = await service.joinRoom(roomId, userId, joinRoomDto);

//       // findActiveRoom에서 createQueryBuilder가 올바르게 호출되었는지 검증
//       expect(roomRepository.createQueryBuilder).toHaveBeenCalledWith('room');
//       expect(queryBuilder.where).toHaveBeenCalledWith('room.id = :roomId', {
//         roomId,
//       });
//       expect(queryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
//         'room.participants',
//         'participants',
//       );
//       expect(queryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
//         'participants.user',
//         'user',
//       );
//       expect(queryBuilder.getOne).toHaveBeenCalled();

//       // validateRoomJoin 검증
//       expect(roomValidatorService.validateRoomJoin).toHaveBeenCalledWith(
//         mockRoom,
//         userId,
//         joinRoomDto.password,
//       );

//       // 참가 로직 검증
//       expect(usersService.getActiveUserById).toHaveBeenCalledWith(userId);
//       expect(roomParticipantService.addParticipant).toHaveBeenCalledWith(
//         mockRoom,
//         mockUser,
//       );

//       // 최신 방 정보 조회 검증
//       expect(roomRepository.findOne).toHaveBeenCalledWith({
//         where: { id: roomId },
//         relations: ['creator', 'participants', 'participants.user'],
//       });

//       expect(result).toEqual({
//         message: ROOM_MESSAGES.JOINED,
//         room: RoomResponseDto.fromEntity(mockRoom),
//       });
//     });

//     it('should throw ConflictException when room not found after join', async () => {
//       // findActiveRoom에서 사용되는 방 조회
//       queryBuilder.getOne.mockResolvedValue(mockRoom);

//       // joinRoom 내에서 최신 상태의 방 조회
//       // 단 한 번만 호출되므로, null을 반환하도록 설정
//       roomRepository.findOne.mockResolvedValue(null);

//       roomValidatorService.validateRoomJoin.mockResolvedValue(undefined);
//       usersService.getActiveUserById.mockResolvedValue(mockUser);
//       roomParticipantService.addParticipant.mockResolvedValue(undefined);

//       await expect(
//         service.joinRoom(roomId, userId, joinRoomDto),
//       ).rejects.toThrow(ConflictException);
//       await expect(
//         service.joinRoom(roomId, userId, joinRoomDto),
//       ).rejects.toThrow(ROOM_ERRORS.ROOM_JOIN_CONFLICT);
//     });

//     it('should throw NotFoundException when room not found', async () => {
//       queryBuilder.getOne.mockResolvedValue(null);

//       await expect(
//         service.joinRoom(roomId, userId, joinRoomDto),
//       ).rejects.toThrow(NotFoundException);
//     });
//   });

//   describe('leaveRoom', () => {
//     const roomId = 'room-123';
//     const userId = 1;
//     it('should leave room successfully when user is participant', async () => {
//       // 방장과 다른 사용자 생성
//       const roomCreator = createUserEntity({ id: 999 });
//       const room = createRoomEntity({ creator: roomCreator });

//       roomRepository.findOne.mockResolvedValue(room);
//       roomParticipantService.leaveRoom.mockResolvedValue(undefined);

//       // 방장이 아닌 사용자(1)가 방을 나가는 상황
//       await service.leaveRoom(userId, roomId);

//       expect(roomRepository.findOne).toHaveBeenCalledWith({
//         where: { id: roomId },
//         withDeleted: true,
//       });
//       expect(roomParticipantService.leaveRoom).toHaveBeenCalledWith(
//         userId,
//         roomId,
//       );
//     });
//     it('should return without action when room is not found', async () => {
//       roomRepository.findOne.mockResolvedValue(null);

//       await expect(service.leaveRoom(userId, roomId)).resolves.not.toThrow();
//       expect(roomRepository.findOne).toHaveBeenCalledWith({
//         where: { id: roomId },
//         withDeleted: true,
//       });
//       expect(roomParticipantService.leaveRoom).not.toHaveBeenCalled();
//     });

//     it('should return without action when room is already deleted', async () => {
//       const deletedRoom = createRoomEntity({ deletedAt: new Date() });
//       roomRepository.findOne.mockResolvedValue(deletedRoom);

//       await expect(service.leaveRoom(userId, roomId)).resolves.not.toThrow();
//       expect(roomRepository.findOne).toHaveBeenCalledWith({
//         where: { id: roomId },
//         withDeleted: true,
//       });
//       expect(roomParticipantService.leaveRoom).not.toHaveBeenCalled();
//     });

//     it('should throw ForbiddenException when user is creator', async () => {
//       const room = createRoomEntity();
//       roomRepository.findOne.mockResolvedValue(room);

//       await expect(service.leaveRoom(room.creator.id, roomId)).rejects.toThrow(
//         ForbiddenException,
//       );
//       await expect(service.leaveRoom(room.creator.id, roomId)).rejects.toThrow(
//         ROOM_ERRORS.CANNOT_LEAVE_AS_CREATOR,
//       );
//       expect(roomRepository.findOne).toHaveBeenCalledWith({
//         where: { id: roomId },
//         withDeleted: true,
//       });
//       expect(roomParticipantService.leaveRoom).not.toHaveBeenCalled();
//     });
//   });

//   describe('deleteRoom', () => {
//     const roomId = 'room-123';
//     const userId = 1;

//     it('should delete room successfully', async () => {
//       const room = createRoomEntity();
//       const actualRoomId = room.id; // 실제 생성된 UUID 사용

//       roomRepository.findOne.mockResolvedValue(room);
//       roomValidatorService.validateRoomCreator.mockImplementation(() => {});
//       roomParticipantService.leaveAllUsersFromRoom.mockResolvedValue(undefined);
//       roomRepository.softDelete.mockResolvedValue({} as any);
//       usersService.updateUser.mockResolvedValue(undefined);

//       await service.deleteRoom(actualRoomId, userId);

//       expect(roomRepository.findOne).toHaveBeenCalledWith({
//         where: { id: actualRoomId },
//         withDeleted: true,
//         relations: ['creator'],
//       });
//       expect(roomValidatorService.validateRoomCreator).toHaveBeenCalledWith(
//         room,
//         userId,
//       );
//       expect(roomParticipantService.leaveAllUsersFromRoom).toHaveBeenCalledWith(
//         actualRoomId,
//       );
//       expect(roomRepository.softDelete).toHaveBeenCalledWith(room.id);
//       if (room.creator) {
//         expect(usersService.updateUser).toHaveBeenCalledWith(room.creator);
//       }
//     });

//     it('should not update creator when room has no creator', async () => {
//       const roomWithoutCreator = createRoomEntity({ creator: null });
//       roomRepository.findOne.mockResolvedValue(roomWithoutCreator);
//       roomValidatorService.validateRoomCreator.mockImplementation(() => {});
//       roomParticipantService.leaveAllUsersFromRoom.mockResolvedValue(undefined);
//       roomRepository.softDelete.mockResolvedValue({} as any);
//       usersService.updateUser.mockResolvedValue(undefined);

//       await service.deleteRoom(roomId, userId);

//       expect(usersService.updateUser).not.toHaveBeenCalled();
//     });

//     it('should return without action when room is not found', async () => {
//       roomRepository.findOne.mockResolvedValue(null);

//       await expect(service.deleteRoom(roomId, userId)).resolves.not.toThrow();
//       expect(roomRepository.findOne).toHaveBeenCalledWith({
//         where: { id: roomId },
//         withDeleted: true,
//         relations: ['creator'],
//       });
//       expect(roomValidatorService.validateRoomCreator).not.toHaveBeenCalled();
//       expect(
//         roomParticipantService.leaveAllUsersFromRoom,
//       ).not.toHaveBeenCalled();
//     });

//     it('should return without action when room is already deleted', async () => {
//       const deletedRoom = createRoomEntity({ deletedAt: new Date() });
//       roomRepository.findOne.mockResolvedValue(deletedRoom);

//       await expect(service.deleteRoom(roomId, userId)).resolves.not.toThrow();
//       expect(roomRepository.findOne).toHaveBeenCalledWith({
//         where: { id: roomId },
//         withDeleted: true,
//         relations: ['creator'],
//       });
//       expect(roomValidatorService.validateRoomCreator).not.toHaveBeenCalled();
//       expect(
//         roomParticipantService.leaveAllUsersFromRoom,
//       ).not.toHaveBeenCalled();
//     });

//     it('should throw ForbiddenException when user is not creator', async () => {
//       const room = createRoomEntity();
//       roomRepository.findOne.mockResolvedValue(room);
//       roomValidatorService.validateRoomCreator.mockImplementation(() => {
//         throw new ForbiddenException();
//       });

//       await expect(service.deleteRoom(roomId, userId)).rejects.toThrow(
//         ForbiddenException,
//       );
//       expect(roomRepository.findOne).toHaveBeenCalledWith({
//         where: { id: roomId },
//         withDeleted: true,
//         relations: ['creator'],
//       });
//       expect(roomValidatorService.validateRoomCreator).toHaveBeenCalledWith(
//         room,
//         userId,
//       );
//       expect(
//         roomParticipantService.leaveAllUsersFromRoom,
//       ).not.toHaveBeenCalled();
//     });
//   });

//   describe('transferCreator', () => {
//     const roomId = 'room-123';
//     const currentUserId = 1;
//     const newCreatorId = 2;
//     let room: Room;
//     let newCreator: any;
//     let oldCreator: any;

//     beforeEach(() => {
//       oldCreator = createUserEntity();
//       newCreator = createUserEntity({ id: newCreatorId });
//       room = createRoomEntity({ creator: oldCreator });
//     });

//     it('should transfer creator successfully', async () => {
//       roomRepository.findOne.mockResolvedValue(room);
//       roomValidatorService.validateRoomTransfer.mockResolvedValue(undefined);
//       usersService.getActiveUserById.mockResolvedValue(newCreator);
//       usersService.updateUser.mockResolvedValue(undefined);
//       roomRepository.save.mockResolvedValue(room);

//       const result = await service.transferCreator(
//         roomId,
//         currentUserId,
//         newCreatorId,
//       );

//       expect(roomRepository.findOne).toHaveBeenCalledWith({
//         where: { id: roomId },
//         relations: ['creator'],
//       });
//       expect(roomValidatorService.validateRoomTransfer).toHaveBeenCalledWith(
//         room,
//         currentUserId,
//         newCreatorId,
//       );
//       expect(usersService.getActiveUserById).toHaveBeenCalledWith(newCreatorId);
//       expect(usersService.updateUser).toHaveBeenCalledWith(oldCreator);
//       expect(usersService.updateUser).toHaveBeenCalledWith(newCreator);
//       expect(roomRepository.save).toHaveBeenCalledWith(room);
//       expect(result).toEqual({
//         message: ROOM_MESSAGES.CREATOR_TRANSFERRED,
//         room: RoomResponseDto.fromEntity(room),
//       });
//     });

//     it('should throw NotFoundException when room not found', async () => {
//       roomRepository.findOne.mockResolvedValue(null);

//       await expect(
//         service.transferCreator(roomId, currentUserId, newCreatorId),
//       ).rejects.toThrow(NotFoundException);
//     });

//     it('should throw BadRequestException when transferring to self', async () => {
//       roomRepository.findOne.mockResolvedValue(room);
//       roomValidatorService.validateRoomTransfer.mockRejectedValue(
//         new BadRequestException(ROOM_ERRORS.CANNOT_TRANSFER_TO_SELF),
//       );

//       await expect(
//         service.transferCreator(roomId, currentUserId, currentUserId),
//       ).rejects.toThrow(BadRequestException);
//       await expect(
//         service.transferCreator(roomId, currentUserId, currentUserId),
//       ).rejects.toThrow(ROOM_ERRORS.CANNOT_TRANSFER_TO_SELF);
//     });
//   });

//   describe('updateParticipantRole', () => {
//     const roomId = 'room-123';
//     const currentUserId = 1;
//     const targetUserId = 2;
//     const newRole = ParticipantRole.GM;
//     let room: Room;
//     let targetParticipant: any;

//     beforeEach(() => {
//       room = createRoomEntity();
//       targetParticipant = createParticipantEntity({
//         user: createUserEntity({ id: targetUserId }),
//       });
//       room.participants = [targetParticipant];
//       roomParticipantService.getParticipant.mockResolvedValue(
//         targetParticipant,
//       );
//     });

//     it('should update participant role successfully', async () => {
//       roomRepository.findOne.mockResolvedValue(room);
//       roomValidatorService.validateRoleChange.mockResolvedValue(undefined);
//       roomParticipantService.updateParticipantRole.mockResolvedValue(undefined);

//       const result = await service.updateParticipantRole(
//         roomId,
//         currentUserId,
//         targetUserId,
//         newRole,
//       );

//       // 첫 번째 호출: 초기 방 정보 조회 (검증을 위한 조회)
//       expect(roomRepository.findOne).toHaveBeenNthCalledWith(1, {
//         where: { id: roomId },
//         relations: ['creator', 'participants', 'participants.user'],
//       });

//       // 검증 로직 검증
//       expect(roomValidatorService.validateRoleChange).toHaveBeenCalledWith(
//         room,
//         currentUserId,
//         targetUserId,
//         newRole,
//       );

//       // 역할 업데이트 검증
//       expect(roomParticipantService.updateParticipantRole).toHaveBeenCalledWith(
//         targetParticipant.id,
//         newRole,
//       );

//       // 두 번째 호출: 변경된 방 정보 조회 (반환을 위한 조회)
//       expect(roomRepository.findOne).toHaveBeenNthCalledWith(2, {
//         where: { id: roomId },
//         relations: ['creator', 'participants', 'participants.user'],
//       });

//       expect(result).toEqual({
//         message: ROOM_MESSAGES.ROLE_UPDATED,
//         room: RoomResponseDto.fromEntity(room),
//       });
//     });

//     it('should throw BadRequestException for invalid role', async () => {
//       const invalidRole = 'INVALID_ROLE' as ParticipantRole;
//       roomRepository.findOne.mockResolvedValue(room);
//       roomValidatorService.validateRoleChange.mockRejectedValue(
//         new BadRequestException(
//           `${ROOM_ERRORS.INVALID_PARTICIPANT_ROLE} (입력값: ${invalidRole})`,
//         ),
//       );

//       await expect(
//         service.updateParticipantRole(
//           roomId,
//           currentUserId,
//           targetUserId,
//           invalidRole,
//         ),
//       ).rejects.toThrow(BadRequestException);
//       await expect(
//         service.updateParticipantRole(
//           roomId,
//           currentUserId,
//           targetUserId,
//           invalidRole,
//         ),
//       ).rejects.toThrow(new RegExp(ROOM_ERRORS.INVALID_PARTICIPANT_ROLE));
//     });

//     it('should throw NotFoundException when room not found', async () => {
//       roomRepository.findOne.mockResolvedValue(null);

//       await expect(
//         service.updateParticipantRole(
//           roomId,
//           currentUserId,
//           targetUserId,
//           newRole,
//         ),
//       ).rejects.toThrow(NotFoundException);
//     });
//   });

//   describe('getRoomWithParticipants', () => {
//     const roomId = 'room-123';

//     it('should get room with participants successfully', async () => {
//       const room = createRoomEntity();
//       queryBuilder.getOne.mockResolvedValue(room);

//       const result = await service.getRoomWithParticipants(roomId);

//       expect(roomRepository.createQueryBuilder).toHaveBeenCalledWith('room');
//       expect(queryBuilder.where).toHaveBeenCalledWith('room.id = :roomId', {
//         roomId,
//       });
//       expect(queryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
//         'room.participants',
//         'participants',
//       );
//       expect(queryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
//         'participants.user',
//         'user',
//       );
//       expect(result).toEqual(RoomResponseDto.fromEntity(room));
//     });

//     it('should throw NotFoundException when room not found', async () => {
//       queryBuilder.getOne.mockResolvedValue(null);

//       await expect(service.getRoomWithParticipants(roomId)).rejects.toThrow(
//         NotFoundException,
//       );
//       expect(queryBuilder.getOne).toHaveBeenCalled();
//     });
//   });
// });
