import { Test, TestingModule } from '@nestjs/testing';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { CreateChatRoomDto } from './dto/create-chat-room.dto';
import { CreateChatMessagesDto } from './dto/create-chat-messages.dto';
import { ChatRoomOperationResponseDto } from './dto/chat-room-operation-response.dto';
import { MessageResponseDto } from './dto/message-response.dto';
import { RequestWithUser } from '@/auth/types/request-with-user.dto';

describe('ChatController', () => {
  let controller: ChatController;
  let service: ChatService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [
        {
          provide: ChatService,
          useValue: {
            createChatRoom: jest.fn(),
            createMessages: jest.fn(),
            getRecentMessages: jest.fn(),
            deleteChatRoom: jest.fn(),
            inviteUser: jest.fn(),
            removeUser: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<ChatController>(ChatController);
    service = module.get<ChatService>(ChatService);
  });

  describe('createRoom', () => {
    it('should call service.createChatRoom and return ChatRoomOperationResponseDto', async () => {
      // Arrange
      const userId = 101;
      const createRoomDto: CreateChatRoomDto = {
        name: 'Test',
        participantIds: [102],
      };
      const mockReq = { user: { id: userId } } as RequestWithUser;
      const mockServiceResult = {
        id: 1,
        name: 'Test',
        participantIds: [101, 102],
      } as any;
      const expectedResponse: ChatRoomOperationResponseDto = {
        message: 'Chat room created successfully.',
        room: mockServiceResult,
      };

      (service.createChatRoom as jest.Mock).mockResolvedValue(
        mockServiceResult,
      );

      // Act
      const result = await controller.createRoom(createRoomDto, mockReq);

      // Assert
      expect(service.createChatRoom).toHaveBeenCalledWith(
        userId,
        createRoomDto,
      );
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('createMessages', () => {
    it('should call service.createMessages and return MessageResponseDto[]', async () => {
      // Arrange
      const userId = 101;
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
      const mockReq = { user: { id: userId } } as RequestWithUser;
      const mockServiceResult: MessageResponseDto[] = [
        { id: 1, senderId: 101, content: 'Hello', sentAt: new Date() },
      ];

      (service.createMessages as jest.Mock).mockResolvedValue(
        mockServiceResult,
      );

      // Act
      const result = await controller.createMessages(
        createMessagesDto,
        mockReq,
      );

      // Assert
      expect(service.createMessages).toHaveBeenCalledWith(
        userId,
        createMessagesDto,
      );
      expect(result).toEqual(mockServiceResult);
    });
  });
});
