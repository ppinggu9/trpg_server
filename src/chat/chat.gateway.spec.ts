// src/chat/chat.gateway.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { WsAuthMiddleware } from '@/auth/ws-auth.middleware';
import { Server, Socket } from 'socket.io';
import { ForbiddenException } from '@nestjs/common';
import { CHAT_ERRORS } from './constant/chat.constant';

// Mock Socket 클래스
class MockSocket {
  handshake = { headers: {} };
  data = {};
  join = jest.fn();
  leave = jest.fn();
  emit = jest.fn();
}

describe('ChatGateway', () => {
  let gateway: ChatGateway;
  let chatService: ChatService;
  let wsAuthMiddleware: WsAuthMiddleware;
  let mockServer: jest.Mocked<Server>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatGateway,
        {
          provide: ChatService,
          useValue: {
            checkUserCanAccessRoom: jest.fn(),
            createMessages: jest.fn(),
          },
        },
        {
          provide: WsAuthMiddleware,
          useValue: {
            // ✅ 핵심: createMiddleware가 실제로 함수를 반환하도록 모킹
            createMiddleware: jest
              .fn()
              .mockReturnValue(
                async (socket: Socket, next: (err?: Error) => void) => {
                  // 실제 미들웨어의 동작을 시뮬레이션
                  // 여기서는 아무것도 하지 않고 next()를 호출
                  next();
                },
              ),
          },
        },
      ],
    }).compile();

    gateway = module.get<ChatGateway>(ChatGateway);
    chatService = module.get<ChatService>(ChatService);
    wsAuthMiddleware = module.get<WsAuthMiddleware>(WsAuthMiddleware);

    // ✅ mockServer 생성
    mockServer = {
      use: jest.fn(), // ✅ 반드시 정의
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    } as unknown as jest.Mocked<Server>;

    // ✅ gateway.server 할당
    (gateway as any).server = mockServer;
  });

  describe('afterInit (Authentication Middleware)', () => {
    it('should register the auth middleware', () => {
      // ✅ afterInit을 명시적으로 호출 → server.use 호출됨
      gateway.afterInit(mockServer);

      // ✅ createMiddleware가 호출되었는지 확인
      expect(wsAuthMiddleware.createMiddleware).toHaveBeenCalled();

      // ✅ server.use가 호출되었고, 인자가 함수인지 확인
      // 이제 createMiddleware가 실제 함수를 반환하므로, use()에 전달된 인자는 Function입니다!
      expect(mockServer.use).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('handleJoinRoom', () => {
    it('should join room and emit "joinedRoom" if user has access', async () => {
      const mockSocket = new MockSocket() as any as Socket;
      mockSocket.data.user = { id: 1 };
      const joinRoomData = { roomId: 123 };

      (chatService.checkUserCanAccessRoom as jest.Mock).mockResolvedValue(
        undefined,
      );

      // ✅ afterInit 호출 → server.use 등록
      gateway.afterInit(mockServer);

      // ✅ connectedUsers 맵 초기화
      const connectedUsers = (gateway as any).connectedUsers;
      connectedUsers.clear(); // 테스트 전 초기화

      await gateway.handleJoinRoom(joinRoomData, mockSocket);

      expect(chatService.checkUserCanAccessRoom).toHaveBeenCalledWith(1, 123);
      expect(mockSocket.join).toHaveBeenCalledWith('room-123');
      expect(mockSocket.emit).toHaveBeenCalledWith('joinedRoom', {
        roomId: 123,
      });

      // ✅ connectedUsers에 추가되었는지 확인
      expect(connectedUsers.has(123)).toBe(true);
      expect(connectedUsers.get(123)).toContain(1);
    });

    it('should emit "error" and NOT join room if user does not have access', async () => {
      const mockSocket = new MockSocket() as any as Socket;
      mockSocket.data.user = { id: 1 };
      const joinRoomData = { roomId: 999 };

      (chatService.checkUserCanAccessRoom as jest.Mock).mockRejectedValue(
        new ForbiddenException(CHAT_ERRORS.INVALID_PARTICIPANT),
      );

      // ✅ afterInit 호출
      gateway.afterInit(mockServer);

      await gateway.handleJoinRoom(joinRoomData, mockSocket);

      expect(mockSocket.join).not.toHaveBeenCalled();
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({
          message: 'Cannot join room: ' + CHAT_ERRORS.INVALID_PARTICIPANT,
        }),
      );
    });
  });

  describe('handleMessage', () => {
    it('should save message and broadcast to room if user has access AND is currently in room', async () => {
      const mockSocket = new MockSocket() as any as Socket;
      mockSocket.data.user = { id: 1 };
      const createMessagesDto = {
        roomId: 123,
        messages: [
          { senderId: 1, content: 'Hello', sentAt: '2024-01-01T00:00:00Z' },
        ],
      };

      (chatService.checkUserCanAccessRoom as jest.Mock).mockResolvedValue(
        undefined,
      );
      (chatService.createMessages as jest.Mock).mockResolvedValue([
        { id: 1, senderId: 1, content: 'Hello', sentAt: new Date() },
      ]);

      // ✅ afterInit 호출
      gateway.afterInit(mockServer);

      // ✅ connectedUsers에 사용자 추가
      const connectedUsers = (gateway as any).connectedUsers;
      connectedUsers.set(123, new Set([1]));

      await gateway.handleMessage(createMessagesDto, mockSocket);

      expect(chatService.checkUserCanAccessRoom).toHaveBeenCalledWith(1, 123);
      expect(chatService.createMessages).toHaveBeenCalledWith(
        1,
        createMessagesDto,
      );
      expect(mockServer.to).toHaveBeenCalledWith('room-123');
      expect(mockServer.emit).toHaveBeenCalledWith(
        'newMessage',
        expect.any(Object),
      );
    });

    it('should emit "error" if user has access but is NOT currently in room', async () => {
      const mockSocket = new MockSocket() as any as Socket;
      mockSocket.data.user = { id: 1 };
      const createMessagesDto = {
        roomId: 123,
        messages: [
          { senderId: 1, content: 'Hello', sentAt: '2024-01-01T00:00:00Z' },
        ],
      };

      (chatService.checkUserCanAccessRoom as jest.Mock).mockResolvedValue(
        undefined,
      );

      // ✅ afterInit 호출
      gateway.afterInit(mockServer);

      // ✅ connectedUsers에 사용자 없음
      const connectedUsers = (gateway as any).connectedUsers;
      connectedUsers.set(123, new Set([2])); // User 2만 접속 중

      await gateway.handleMessage(createMessagesDto, mockSocket);

      expect(chatService.checkUserCanAccessRoom).toHaveBeenCalledWith(1, 123);
      expect(chatService.createMessages).not.toHaveBeenCalled();
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ message: CHAT_ERRORS.INVALID_PARTICIPANT }),
      );
      expect(mockServer.to).not.toHaveBeenCalledWith('room-123');
    });
  });

  describe('handleLeaveRoom', () => {
    it('should remove user from connectedUsers and leave room', async () => {
      const mockSocket = new MockSocket() as any as Socket;
      mockSocket.data.user = { id: 1 };
      const leaveRoomData = { roomId: 123 };

      // ✅ afterInit 호출
      gateway.afterInit(mockServer);

      // ✅ connectedUsers에 사용자 추가
      const connectedUsers = (gateway as any).connectedUsers;
      connectedUsers.set(123, new Set([1, 2]));

      await gateway.handleLeaveRoom(leaveRoomData, mockSocket);

      expect(connectedUsers.get(123)?.has(1)).toBe(false);
      expect(mockSocket.leave).toHaveBeenCalledWith('room-123');
      expect(mockSocket.emit).toHaveBeenCalledWith('leftRoom', { roomId: 123 });
    });
  });

  describe('handleDisconnect', () => {
    it('should remove user from all rooms on disconnect', async () => {
      const mockSocket = new MockSocket() as any as Socket;
      mockSocket.data.user = { id: 1 };

      // ✅ afterInit 호출
      gateway.afterInit(mockServer);

      const connectedUsers = (gateway as any).connectedUsers;
      connectedUsers.set(123, new Set([1, 2]));
      connectedUsers.set(456, new Set([1, 3]));

      gateway.handleDisconnect(mockSocket);

      expect(connectedUsers.get(123)?.has(1)).toBe(false);
      expect(connectedUsers.get(456)?.has(1)).toBe(false);
      expect(connectedUsers.has(123)).toBe(true); // User 2가 남아 있음
      expect(connectedUsers.has(456)).toBe(true); // User 3이 남아 있음
    });
  });
});
