// src/chat/chat.gateway.e2e-spec.ts
import { INestApplication } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '@/users/entities/user.entity';
import { createUserDto } from '@/users/factory/user.factory';
import { io } from 'socket.io-client';
import * as request from 'supertest';
import { ChatParticipant } from '@/chat/entities/chat-participant.entity';
import { ChatRoom } from '@/chat/entities/chat-room.entity';
import { ChatMessage } from '@/chat/entities/chat-message.entity';
import { CreateChatRoomDto } from '@/chat/dto/create-chat-room.dto';
import { CHAT_ERRORS } from '@/chat/constant/chat.constant';
import { setupTestApp, signUpAndLogin } from './utils/test.util';

// 테스트용 WebSocket 클라이언트 타입
type TestSocket = ReturnType<typeof io> & {
  // ✅ io 함수의 반환 타입을 기반으로 확장
  waitForEvent: (event: string, timeoutMs?: number) => Promise<any>;
};

// WebSocket 클라이언트 생성 및 이벤트 대기 헬퍼 함수
function createSocketClient(
  url: string,
  token: string,
  options: Parameters<typeof io>[1] = {},
): TestSocket {
  const socket = io(url, {
    ...options,
    // ✅ 수정: headers에 Authorization 헤더 설정
    extraHeaders: {
      authorization: `Bearer ${token}`,
    },
    transports: ['websocket'],
  }) as TestSocket;

  // 특정 이벤트를 대기하는 Promise 헬퍼 메서드 추가
  socket.waitForEvent = (event: string, timeoutMs = 5000) => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        socket.off(event); // 타임아웃 시 리스너 제거
        reject(new Error(`Timeout waiting for event: ${event}`));
      }, timeoutMs);

      socket.once(event, (data) => {
        clearTimeout(timeout);
        resolve(data);
      });
    });
  };

  return socket;
}

describe('ChatGateway (e2e) - WebSocket', () => {
  let app: INestApplication;
  let module: TestingModule;
  let userRepository: Repository<User>;
  let chatMessageRepository: Repository<ChatMessage>;
  let chatRoomRepository: Repository<ChatRoom>;
  let chatParticipantRepository: Repository<ChatParticipant>;

  let accessTokens: string[];
  let users: User[];
  const userInfos = Array(5)
    .fill('')
    .map(() => createUserDto());

  const GATEWAY_URL = 'http://localhost:11123/chat'; // Gateway 포트와 네임스페이스

  beforeAll(async () => {
    // 앱 모듈 컴파일
    const testApp = await setupTestApp();
    ({ app, module } = testApp);

    // 의존성 주입

    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    chatMessageRepository = module.get<Repository<ChatMessage>>(
      getRepositoryToken(ChatMessage),
    );
    chatRoomRepository = module.get<Repository<ChatRoom>>(
      getRepositoryToken(ChatRoom),
    );
    chatParticipantRepository = module.get<Repository<ChatParticipant>>(
      getRepositoryToken(ChatParticipant),
    );
  }, 30000);

  beforeAll(async () => {
    accessTokens = await Promise.all(
      userInfos.map(async (userInfo) => {
        const token = await signUpAndLogin(app, userInfo);
        if (!token) {
          throw new Error(
            `Failed to sign up or log in user: ${userInfo.email}`,
          );
        }
        return token;
      }),
    );

    users = await Promise.all(
      userInfos.map(async (userInfo) => {
        const user = await userRepository.findOne({
          where: { email: userInfo.email },
        });
        if (!user) {
          throw new Error(`User not found: ${userInfo.email}`);
        }
        return user;
      }),
    );

    expect(accessTokens).toHaveLength(5);
    expect(users).toHaveLength(5);
  });

  beforeEach(async () => {
    await chatMessageRepository.createQueryBuilder().delete().execute();
    await chatParticipantRepository.createQueryBuilder().delete().execute();
    await chatRoomRepository.createQueryBuilder().delete().execute();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('WebSocket Connection & Authentication', () => {
    it('S-GW-1: 유효한 JWT 토큰으로 연결 성공', async () => {
      // ✅ Given: 유효한 토큰으로 소켓 생성
      const socket = createSocketClient(GATEWAY_URL, accessTokens[0]);

      // ✅ When: 연결 대기
      await new Promise<void>((resolve, reject) => {
        socket.on('connect', () => {
          resolve();
        });
        socket.on('connect_error', (err) => {
          reject(new Error(`Connection failed: ${err.message}`));
        });
      });

      // ✅ Then: 연결 성공 확인
      expect(socket.connected).toBe(true);
      // 연결 해제
      socket.disconnect();
    });

    it('F-GW-1: 유효하지 않은 JWT 토큰으로 연결 시도 실패', async () => {
      // ✅ Given: 유효하지 않은 토큰으로 소켓 생성
      const socket = createSocketClient(GATEWAY_URL, 'invalid.token.here');

      // ✅ When & Then: 연결 실패 확인
      await expect(
        new Promise<void>((resolve, reject) => {
          socket.on('connect', () => {
            reject(new Error('Should not connect with invalid token'));
          });
          socket.on('connect_error', () => {
            resolve();
          });
        }),
      ).resolves.not.toThrow();

      expect(socket.connected).toBe(false);
      socket.disconnect();
    });

    it('F-GW-2: 토큰 없이 연결 시도 실패', async () => {
      // ✅ Given: 토큰 없이 소켓 생성
      const socket = createSocketClient(GATEWAY_URL, '');

      // ✅ When & Then: 연결 실패 확인
      await expect(
        new Promise<void>((resolve, reject) => {
          socket.on('connect', () => {
            reject(new Error('Should not connect without token'));
          });
          socket.on('connect_error', () => {
            resolve();
          });
        }),
      ).resolves.not.toThrow();

      expect(socket.connected).toBe(false);
      socket.disconnect();
    });
  });

  describe('Room Join & Leave & Messaging', () => {
    let roomId: number;
    let socket1: TestSocket; // User 0
    let socket2: TestSocket; // User 1

    beforeEach(async () => {
      // ✅ Given: 테스트용 채팅방 생성 (HTTP API 사용)
      const createRoomDto: CreateChatRoomDto = {
        name: 'Test Room for WebSocket',
        participantIds: [users[1].id], // User 0 (creator) and User 1
      };
      const roomResponse = await request(app.getHttpServer())
        .post('/chat/rooms')
        .set('Authorization', `Bearer ${accessTokens[0]}`)
        .send(createRoomDto)
        .expect(201);

      roomId = roomResponse.body.room.id;

      // ✅ Given: 두 명의 사용자가 WebSocket에 연결
      socket1 = createSocketClient(GATEWAY_URL, accessTokens[0]);
      socket2 = createSocketClient(GATEWAY_URL, accessTokens[1]);

      // 연결 대기
      await Promise.all([
        new Promise<void>((resolve) => socket1.on('connect', resolve)),
        new Promise<void>((resolve) => socket2.on('connect', resolve)),
      ]);

      expect(socket1.connected).toBe(true);
      expect(socket2.connected).toBe(true);
    });

    afterEach(() => {
      // 모든 테스트 후 소켓 연결 해제
      socket1?.disconnect();
      socket2?.disconnect();
    });

    it('S-GW-2: 사용자가 방에 참여하고, 메시지를 보내고, 다른 사용자가 메시지를 받음', async () => {
      // ✅ When: User 0이 방에 참여
      socket1.emit('joinRoom', { roomId });
      const joinAck1 = await socket1.waitForEvent('joinedRoom');
      expect(joinAck1).toEqual({ roomId });

      // ✅ When: User 1이 방에 참여
      socket2.emit('joinRoom', { roomId });
      const joinAck2 = await socket2.waitForEvent('joinedRoom');
      expect(joinAck2).toEqual({ roomId });

      // ✅ When: User 0이 메시지 전송
      const testMessage = {
        roomId,
        messages: [
          {
            senderId: users[0].id,
            content: 'Hello from WebSocket!',
            sentAt: new Date().toISOString(),
          },
        ],
      };
      socket1.emit('sendMessage', testMessage);

      // ✅ Then: User 1이 메시지를 수신
      const receivedMessage = await socket2.waitForEvent('newMessage');
      expect(receivedMessage).toMatchObject({
        senderId: users[0].id,
        content: 'Hello from WebSocket!',
      });

      // ✅ Then: DB에 메시지가 저장되었는지 확인
      const savedMessages = await chatMessageRepository.find({
        where: { chatRoom: { id: roomId } },
        relations: { sender: true },
      });
      expect(savedMessages).toHaveLength(1);
      expect(savedMessages[0].content).toEqual('Hello from WebSocket!');
      expect(savedMessages[0].sender.id).toEqual(users[0].id);
    });

    it('F-GW-3: 참여하지 않은 사용자가 메시지 전송 시도 (권한 없음)', async () => {
      // ✅ Given: User 0만 방에 참여
      socket1.emit('joinRoom', { roomId });
      await socket1.waitForEvent('joinedRoom');

      // ✅ When: User 1이 참여하지 않은 상태에서 메시지 전송 시도
      const testMessage = {
        roomId,
        messages: [
          {
            senderId: users[1].id,
            content: 'Sneaky message!',
            sentAt: new Date().toISOString(),
          },
        ],
      };
      socket2.emit('sendMessage', testMessage);

      // ✅ Then: User 1은 'error' 이벤트를 수신해야 함
      const errorEvent = await socket2.waitForEvent('error');
      expect(errorEvent.message).toContain(CHAT_ERRORS.INVALID_PARTICIPANT);

      // ✅ Then: DB에 메시지가 저장되지 않음
      const savedMessages = await chatMessageRepository.find({
        where: { chatRoom: { id: roomId } },
      });
      expect(savedMessages).toHaveLength(0);
    });

    it('S-GW-3: 사용자가 방에서 퇴장하면 더 이상 메시지를 받지 않음', async () => {
      // ✅ Given: 두 사용자 모두 방에 참여
      socket1.emit('joinRoom', { roomId });
      socket2.emit('joinRoom', { roomId });
      await socket1.waitForEvent('joinedRoom');
      await socket2.waitForEvent('joinedRoom');

      // ✅ When: User 1이 방에서 퇴장
      socket2.emit('leaveRoom', { roomId });
      const leaveAck = await socket2.waitForEvent('leftRoom');
      expect(leaveAck).toEqual({ roomId });

      // ✅ When: User 0이 메시지 전송
      const testMessage = {
        roomId,
        messages: [
          {
            senderId: users[0].id,
            content: 'This message should not be received by User 1',
            sentAt: new Date().toISOString(),
          },
        ],
      };
      socket1.emit('sendMessage', testMessage);

      // ✅ Then: User 1은 'newMessage' 이벤트를 받지 않아야 함
      // 대신, 타임아웃이 발생해야 함 (이벤트 미수신)
      await expect(
        socket2.waitForEvent('newMessage', 2000), // 2초 타임아웃
      ).rejects.toThrow(); // ✅ 어떤 에러든 발생하면 성공
    });

    it('F-GW-4: 존재하지 않는 방에 참여 시도', async () => {
      const nonExistentRoomId = 999999;

      // ✅ When: 존재하지 않는 방에 참여 시도
      socket1.emit('joinRoom', { roomId: nonExistentRoomId });

      // ✅ Then: 'error' 이벤트 수신
      const errorEvent = await socket1.waitForEvent('error');
      expect(errorEvent.message).toContain(CHAT_ERRORS.INVALID_PARTICIPANT);
    });
  });
});
