import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatService } from './chat.service';
import { ChatRoom } from './entities/chat-room.entity';
import { ChatParticipant } from './entities/chat-participant.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { CreateChatRoomDto } from './dto/create-chat-room.dto';
import { CreateChatMessagesDto } from './dto/create-chat-messages.dto';
import { UsersService } from '@/users/users.service';
import { CHAT_ERRORS } from './constant/chat.constant';

jest.mock('typeorm-transactional', () => ({
  Transactional: () => () => ({}),
}));

// Mock Repository Factory
const createMockRepository = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  softDelete: jest.fn(),
});

describe('ChatService', () => {
  let service: ChatService;
  let chatRoomRepository: Repository<ChatRoom>;
  let chatParticipantRepository: Repository<ChatParticipant>;
  let chatMessageRepository: Repository<ChatMessage>;
  let usersService: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        {
          provide: getRepositoryToken(ChatRoom),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(ChatParticipant),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(ChatMessage),
          useValue: createMockRepository(),
        },
        {
          provide: UsersService,
          useValue: {
            getUserById: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
    chatRoomRepository = module.get<Repository<ChatRoom>>(
      getRepositoryToken(ChatRoom),
    );
    chatParticipantRepository = module.get<Repository<ChatParticipant>>(
      getRepositoryToken(ChatParticipant),
    );
    chatMessageRepository = module.get<Repository<ChatMessage>>(
      getRepositoryToken(ChatMessage),
    );
    usersService = module.get<UsersService>(UsersService);
  });

  describe('createChatRoom', () => {
    it('should create a chat room and add participants successfully', async () => {
      // Arrange
      const userId = 101;
      const createRoomDto: CreateChatRoomDto = {
        name: 'Test Room',
        participantIds: [102, 103],
      };

      const mockChatRoom = {
        id: 1,
        name: 'Test Room',
        creator: { id: userId },
        isActive: true,
        createdAt: new Date(),
      };
      const mockUser101 = { id: 101, name: 'User101' };
      const mockUser102 = { id: 102, name: 'User102' };
      const mockUser103 = { id: 103, name: 'User103' };

      (chatRoomRepository.create as jest.Mock).mockReturnValue(mockChatRoom);
      (chatRoomRepository.save as jest.Mock).mockResolvedValue(mockChatRoom);
      (usersService.getUserById as jest.Mock)
        .mockResolvedValueOnce(mockUser101) // creator
        .mockResolvedValueOnce(mockUser102) // participant 102
        .mockResolvedValueOnce(mockUser103); // participant 103

      (chatParticipantRepository.create as jest.Mock).mockImplementation(
        (data) => ({ ...data }),
      );
      (chatParticipantRepository.save as jest.Mock).mockResolvedValue({});

      (chatRoomRepository.findOne as jest.Mock).mockResolvedValue(mockChatRoom);

      // Act
      const result = await service.createChatRoom(userId, createRoomDto);

      // Assert
      expect(chatRoomRepository.create).toHaveBeenCalledWith({
        name: 'Test Room',
        creator: { id: userId },
      });
      expect(chatRoomRepository.save).toHaveBeenCalledWith(mockChatRoom);

      expect(usersService.getUserById).toHaveBeenCalledTimes(3);
      expect(usersService.getUserById).toHaveBeenCalledWith(101);
      expect(usersService.getUserById).toHaveBeenCalledWith(102);
      expect(usersService.getUserById).toHaveBeenCalledWith(103);

      expect(chatParticipantRepository.create).toHaveBeenCalledTimes(3);
      expect(chatParticipantRepository.save).toHaveBeenCalledTimes(3);

      expect(result).toBeDefined();
      expect(result.id).toEqual(1);
      expect(result.participantIds).toEqual([101, 102, 103]);
    });

    it('should throw BadRequestException if a participant does not exist', async () => {
      // Arrange
      const userId = 101;
      const createRoomDto: CreateChatRoomDto = {
        name: 'Test Room',
        participantIds: [999], // 존재하지 않는 사용자
      };

      const mockChatRoom = {
        id: 1,
        name: 'Test Room',
        creator: { id: userId },
        isActive: true,
        createdAt: new Date(),
      };
      const mockUser101 = { id: 101, name: 'User101' };

      (chatRoomRepository.create as jest.Mock).mockReturnValue(mockChatRoom);
      (chatRoomRepository.save as jest.Mock).mockResolvedValue(mockChatRoom);
      (usersService.getUserById as jest.Mock)
        .mockResolvedValueOnce(mockUser101) // creator
        .mockResolvedValueOnce(null); // participant 999 does not exist

      // Act & Assert
      await expect(
        service.createChatRoom(userId, createRoomDto),
      ).rejects.toThrow(CHAT_ERRORS.NON_EXISTED_USER);
    });
  });

  describe('createMessages', () => {
    it('should save messages if requester and senders are valid participants', async () => {
      // Arrange
      const requesterUserId = 101;
      const createMessagesDto: CreateChatMessagesDto = {
        roomId: 1,
        messages: [
          {
            senderId: 101,
            content: 'Hello',
            sentAt: '2024-06-07T10:00:00.000Z',
          },
          {
            senderId: 102,
            content: 'Hi there!',
            sentAt: '2024-06-07T10:01:00.000Z',
          },
        ],
      };

      const mockParticipant101 = {
        id: 1,
        user: { id: 101 },
        chatRoom: { id: 1 },
      };
      const mockParticipant102 = {
        id: 2,
        user: { id: 102 },
        chatRoom: { id: 1 },
      };
      const mockSavedMessages = [
        {
          id: 1,
          sender: { id: 101 },
          content: 'Hello',
          sentAt: new Date('2024-06-07T10:00:00.000Z'),
          chatRoom: { id: 1 },
        },
        {
          id: 2,
          sender: { id: 102 },
          content: 'Hi there!',
          sentAt: new Date('2024-06-07T10:01:00.000Z'),
          chatRoom: { id: 1 },
        },
      ];

      (chatParticipantRepository.findOne as jest.Mock)
        .mockResolvedValueOnce(mockParticipant101) // requester check
        .mockResolvedValueOnce(mockParticipant101) // sender 101 check
        .mockResolvedValueOnce(mockParticipant102); // sender 102 check

      (chatMessageRepository.create as jest.Mock).mockImplementation(
        (data) => data,
      );
      (chatMessageRepository.save as jest.Mock).mockResolvedValue(
        mockSavedMessages,
      );

      // Act
      const result = await service.createMessages(
        requesterUserId,
        createMessagesDto,
      );

      // Assert
      expect(chatParticipantRepository.findOne).toHaveBeenCalledTimes(3);
      expect(chatMessageRepository.create).toHaveBeenCalledTimes(2);
      expect(chatMessageRepository.save).toHaveBeenCalledWith([
        {
          sender: { id: 101 },
          chatRoom: { id: 1 },
          content: 'Hello',
          sentAt: new Date('2024-06-07T10:00:00.000Z'),
        },
        {
          sender: { id: 102 },
          chatRoom: { id: 1 },
          content: 'Hi there!',
          sentAt: new Date('2024-06-07T10:01:00.000Z'),
        },
      ]);

      expect(result).toHaveLength(2);
      expect(result[0].content).toEqual('Hello');
      expect(result[1].content).toEqual('Hi there!');
    });

    it('should throw ForbiddenException if a sender is not a participant', async () => {
      // Arrange
      const requesterUserId = 101;
      const createMessagesDto: CreateChatMessagesDto = {
        roomId: 1,
        messages: [
          {
            senderId: 101,
            content: 'Hello',
            sentAt: '2024-06-07T10:00:00.000Z',
          },
          {
            senderId: 999,
            content: 'Sneaky message!',
            sentAt: '2024-06-07T10:01:00.000Z',
          }, // Not a participant
        ],
      };

      const mockParticipant101 = {
        id: 1,
        user: { id: 101 },
        chatRoom: { id: 1 },
      };

      (chatParticipantRepository.findOne as jest.Mock)
        .mockResolvedValueOnce(mockParticipant101) // requester check
        .mockResolvedValueOnce(mockParticipant101) // sender 101 check
        .mockResolvedValueOnce(null); // sender 999 check -> fails

      // Act & Assert
      await expect(
        service.createMessages(requesterUserId, createMessagesDto),
      ).rejects.toThrow(CHAT_ERRORS.NON_EXISTED_USER_WITH_ID(999));
    });

    it('should throw ForbiddenException if requester is not a participant', async () => {
      // Arrange
      const requesterUserId = 999; // Not a participant
      const createMessagesDto: CreateChatMessagesDto = {
        roomId: 1,
        messages: [
          {
            senderId: 101,
            content: 'Hello',
            sentAt: '2024-06-07T10:00:00.000Z',
          },
        ],
      };

      (chatParticipantRepository.findOne as jest.Mock).mockResolvedValueOnce(
        null,
      ); // requester check fails

      // Act & Assert
      await expect(
        service.createMessages(requesterUserId, createMessagesDto),
      ).rejects.toThrow(CHAT_ERRORS.INVALID_PARTICIPANT);
    });
  });
});
