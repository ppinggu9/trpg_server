import { User } from '@/users/entities/user.entity';
import { INestApplication } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as request from 'supertest';
import {
  setupTestApp,
  signUpAndLogin,
  truncateAllTables,
} from './utils/test.util';
import { ChatMessage } from '@/chat/entities/chat-message.entity';
import { ChatRoom } from '@/chat/entities/chat-room.entity';
import { ChatParticipant } from '@/chat/entities/chat-participant.entity';
import { createUserDto } from '@/users/factory/user.factory';
import { CreateChatRoomDto } from '@/chat/dto/create-chat-room.dto';
import { CHAT_ERRORS } from '@/chat/constant/chat.constant';
import { CreateChatMessagesDto } from '@/chat/dto/create-chat-messages.dto';
import { InviteUserDto } from '@/chat/dto/invite-user.dto';

describe('Chat - /chat (e2e)', () => {
  let app: INestApplication;
  let module: TestingModule;
  let dataSource: DataSource;
  let userRepository: Repository<User>;
  let chatMessageRepository: Repository<ChatMessage>;
  let chatRoomRepository: Repository<ChatRoom>;
  let chatParticipantRepository: Repository<ChatParticipant>;
  let accessTokens: string[];
  let users: User[];

  const userInfos = Array(5)
    .fill('')
    .map(() => createUserDto());

  beforeAll(async () => {
    const testApp = await setupTestApp();
    ({ app, module, dataSource } = testApp);

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
    await truncateAllTables(dataSource);
    await app.close();
  });

  describe('POST /chat/rooms - 채팅방 생성', () => {
    it('F1-0: 인증되지 않은 사용자의 방 생성시도', async () => {
      const createRoomDto: CreateChatRoomDto = {
        name: users[0].name,
        participantIds: [9999999],
      };

      await request(app.getHttpServer())
        .post('/chat/rooms')
        .send(createRoomDto)
        .expect(401);
    });

    it('S1-1: 기본적인 채팅방 생성', async () => {
      const createRoomDto: CreateChatRoomDto = {
        name: users[0].name,
        participantIds: [users[1].id],
      };

      const response = await request(app.getHttpServer())
        .post('/chat/rooms')
        .set('Authorization', `Bearer ${accessTokens[0]}`)
        .send(createRoomDto)
        .expect(201);

      expect(response.body).toMatchObject({
        message: 'Chat room created successfully.',
        room: {
          id: expect.any(Number),
          participantIds: [users[0].id, users[1].id],
        },
      });

      const chatRooms = await chatRoomRepository.find({
        where: { id: response.body.room.id },
        relations: { creator: true },
      });
      expect(chatRooms.length).toBe(1);
      expect(chatRooms[0].creator.id).toEqual(users[0].id);

      const chatParticipants = await chatParticipantRepository.find({
        where: { chatRoom: { id: response.body.room.id } },
        relations: { user: true },
      });
      expect(chatParticipants).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            user: expect.objectContaining({
              id: users[0].id,
            }),
          }),
          expect.objectContaining({
            user: expect.objectContaining({
              id: users[1].id,
            }),
          }),
        ]),
      );
      expect(chatParticipants).toHaveLength(2);
    });
    it('F1-1: 존재하지 않는 사용자를 참여자로 지정', async () => {
      const createRoomDto: CreateChatRoomDto = {
        name: users[0].name,
        participantIds: [9999999],
      };

      const response = await request(app.getHttpServer())
        .post('/chat/rooms')
        .set('Authorization', `Bearer ${accessTokens[0]}`)
        .send(createRoomDto)
        .expect(400);

      expect(response.body).toMatchObject({
        message: CHAT_ERRORS.NON_EXISTED_USER,
      });

      const chatRooms = await chatRoomRepository.find();
      expect(chatRooms.length).toBe(0);

      const chatParticipants = await chatParticipantRepository.find();
      expect(chatParticipants.length).toBe(0);
    });
  });

  describe('POST /chat/messages - 메시지 배치 저장', () => {
    let roomId: number;

    beforeEach(async () => {
      const createRoomDto: CreateChatRoomDto = {
        name: users[0].name,
        participantIds: [users[1].id],
      };

      const response = await request(app.getHttpServer())
        .post('/chat/rooms')
        .set('Authorization', `Bearer ${accessTokens[0]}`)
        .send(createRoomDto)
        .expect(201);

      expect(response.body).toMatchObject({
        message: 'Chat room created successfully.',
        room: {
          id: expect.any(Number),
          participantIds: [users[0].id, users[1].id],
        },
      });

      roomId = response.body.room.id;
    });

    it('F2-0: 인증되지 않은 참여자의 메세지 저장 시도', async () => {
      const chatMessagesDto: CreateChatMessagesDto = {
        roomId,
        messages: [
          {
            senderId: users[0].id,
            content: 'test',
            sentAt: new Date().toISOString(),
          },
        ],
      };

      await request(app.getHttpServer())
        .post('/chat/messages')
        .send(chatMessagesDto)
        .expect(401);
    });

    it('S2-1: 유효한 참여자가 자신의 메시지를 저장', async () => {
      const now = new Date().toISOString();
      const chatMessagesDto: CreateChatMessagesDto = {
        roomId,
        messages: [
          {
            senderId: users[0].id,
            content: 'test',
            sentAt: now,
          },
        ],
      };

      const response = await request(app.getHttpServer())
        .post('/chat/messages')
        .set('Authorization', `Bearer ${accessTokens[0]}`)
        .send(chatMessagesDto)
        .expect(201);

      expect(response.body).toMatchObject([
        {
          id: expect.any(Number),
          senderId: users[0].id,
          content: 'test',
          sentAt: now,
        },
      ]);

      const message = await chatMessageRepository.find({
        where: { id: response.body.id },
      });
      expect(message.length).toBe(1);
      expect(message[0].content).toEqual('test');
    });

    it('S2-2: 유효한 참여자가 다른 참여자의 메시지를 저장 (웹소켓 서버 시나리오)', async () => {
      // 1. 각 메시지마다 고유한 시간 생성
      const now = new Date();
      const time1 = new Date(now.getTime() - 2000).toISOString(); // 2초 전
      const time2 = new Date(now.getTime() - 1000).toISOString(); // 1초 전
      const time3 = now.toISOString(); // 현재 시간

      const chatMessagesDto: CreateChatMessagesDto = {
        roomId,
        messages: [
          {
            senderId: users[1].id,
            content: 'test1',
            sentAt: time1, // 고유한 시간 1
          },
          {
            senderId: users[1].id,
            content: 'test2',
            sentAt: time2, // 고유한 시간 2
          },
          {
            senderId: users[0].id,
            content: 'test3',
            sentAt: time3, // 고유한 시간 3
          },
        ],
      };

      // 2. API 호출
      const response = await request(app.getHttpServer())
        .post('/chat/messages')
        .set('Authorization', `Bearer ${accessTokens[0]}`)
        .send(chatMessagesDto)
        .expect(201);

      // 3. 응답 검증
      expect(response.body).toHaveLength(3);
      expect(response.body[0]).toMatchObject({
        id: expect.any(Number),
        senderId: users[1].id,
        content: 'test1',
        sentAt: time1, // 응답에 time1이 정확히 포함되어 있는지 확인
      });
      expect(response.body[1]).toMatchObject({
        id: expect.any(Number),
        senderId: users[1].id,
        content: 'test2',
        sentAt: time2, // 응답에 time2가 정확히 포함되어 있는지 확인
      });
      expect(response.body[2]).toMatchObject({
        id: expect.any(Number),
        senderId: users[0].id,
        content: 'test3',
        sentAt: time3, // 응답에 time3이 정확히 포함되어 있는지 확인
      });

      // 4. DB에서 직접 조회하여 시간이 정확히 저장되었는지 검증
      const savedMessages = await chatMessageRepository.find({
        where: { chatRoom: { id: roomId } },
        order: { sentAt: 'ASC' }, // sentAt 오름차순으로 정렬
      });

      expect(savedMessages).toHaveLength(3);
      // 첫 번째 메시지
      expect(savedMessages[0].content).toEqual('test1');
      expect(savedMessages[0].sentAt.toISOString()).toEqual(time1); // DB 저장 시간 검증

      // 두 번째 메시지
      expect(savedMessages[1].content).toEqual('test2');
      expect(savedMessages[1].sentAt.toISOString()).toEqual(time2); // DB 저장 시간 검증

      // 세 번째 메시지
      expect(savedMessages[2].content).toEqual('test3');
      expect(savedMessages[2].sentAt.toISOString()).toEqual(time3); // DB 저장 시간 검증
    });

    it('F2-1: 비참여자가 메시지 저장 시도', async () => {
      const now = new Date().toISOString();
      const chatMessagesDto: CreateChatMessagesDto = {
        roomId,
        messages: [
          {
            senderId: users[0].id,
            content: 'test',
            sentAt: now,
          },
        ],
      };

      const response = await request(app.getHttpServer())
        .post('/chat/messages')
        .set('Authorization', `Bearer ${accessTokens[2]}`)
        .send(chatMessagesDto)
        .expect(403);

      expect(response.body).toMatchObject({
        message: CHAT_ERRORS.INVALID_PARTICIPANT,
      });

      const savedMessages = await chatMessageRepository.find({
        where: { chatRoom: { id: roomId } },
        order: { sentAt: 'ASC' }, // sentAt 오름차순으로 정렬
      });

      expect(savedMessages.length).toBe(0);
    });

    it('F2-2: 참여자가 비참여자의 메시지를 저장 시도', async () => {
      const now = new Date().toISOString();
      const chatMessagesDto: CreateChatMessagesDto = {
        roomId,
        messages: [
          {
            senderId: users[2].id,
            content: 'test',
            sentAt: now,
          },
        ],
      };

      const response = await request(app.getHttpServer())
        .post('/chat/messages')
        .set('Authorization', `Bearer ${accessTokens[1]}`)
        .send(chatMessagesDto)
        .expect(403);

      expect(response.body).toMatchObject({
        message: CHAT_ERRORS.NON_EXISTED_USER_WITH_ID(users[2].id),
      });

      const savedMessages = await chatMessageRepository.find({
        where: { chatRoom: { id: roomId } },
        order: { sentAt: 'ASC' }, // sentAt 오름차순으로 정렬
      });

      expect(savedMessages.length).toBe(0);
    });
  });

  describe('GET /chat/rooms/:roomId/messages - 최근 메시지 조회', () => {
    let roomId: number;
    let time1: string;
    let time2: string;
    let time3: string;

    beforeEach(async () => {
      const createRoomDto: CreateChatRoomDto = {
        name: users[0].name,
        participantIds: [users[1].id],
      };

      let response = await request(app.getHttpServer())
        .post('/chat/rooms')
        .set('Authorization', `Bearer ${accessTokens[0]}`)
        .send(createRoomDto)
        .expect(201);

      expect(response.body).toMatchObject({
        message: 'Chat room created successfully.',
        room: {
          id: expect.any(Number),
          participantIds: [users[0].id, users[1].id],
        },
      });

      roomId = response.body.room.id;

      const now = new Date();
      time1 = new Date(now.getTime() - 2000).toISOString(); // 2초 전
      time2 = new Date(now.getTime() - 1000).toISOString(); // 1초 전
      time3 = now.toISOString(); // 현재 시간

      const chatMessagesDto: CreateChatMessagesDto = {
        roomId,
        messages: [
          {
            senderId: users[1].id,
            content: 'test1',
            sentAt: time1, // 고유한 시간 1
          },
          {
            senderId: users[1].id,
            content: 'test2',
            sentAt: time2, // 고유한 시간 2
          },
          {
            senderId: users[0].id,
            content: 'test3',
            sentAt: time3, // 고유한 시간 3
          },
        ],
      };

      // 2. API 호출
      response = await request(app.getHttpServer())
        .post('/chat/messages')
        .set('Authorization', `Bearer ${accessTokens[0]}`)
        .send(chatMessagesDto)
        .expect(201);

      // 3. 응답 검증
      expect(response.body).toHaveLength(3);
      expect(response.body[0]).toMatchObject({
        id: expect.any(Number),
        senderId: users[1].id,
        content: 'test1',
        sentAt: time1, // 응답에 time1이 정확히 포함되어 있는지 확인
      });
      expect(response.body[1]).toMatchObject({
        id: expect.any(Number),
        senderId: users[1].id,
        content: 'test2',
        sentAt: time2, // 응답에 time2가 정확히 포함되어 있는지 확인
      });
      expect(response.body[2]).toMatchObject({
        id: expect.any(Number),
        senderId: users[0].id,
        content: 'test3',
        sentAt: time3, // 응답에 time3이 정확히 포함되어 있는지 확인
      });
    });

    it('F3-0: 인증되지 않은 참여자의 메세지 조회 시도', async () => {
      await request(app.getHttpServer())
        .get(`/chat/rooms/${roomId}/messages`)
        .expect(401);
    });

    it('S3-1: 참여자가 자신의 채팅방 메시지 조회', async () => {
      const response = await request(app.getHttpServer())
        .get(`/chat/rooms/${roomId}/messages`)
        .set('Authorization', `Bearer ${accessTokens[0]}`)
        .expect(200);

      expect(response.body).toHaveLength(3);
      expect(response.body[0]).toMatchObject({
        id: expect.any(Number),
        senderId: users[1].id,
        content: 'test1',
        sentAt: time1, // 응답에 time1이 정확히 포함되어 있는지 확인
      });
      expect(response.body[1]).toMatchObject({
        id: expect.any(Number),
        senderId: users[1].id,
        content: 'test2',
        sentAt: time2, // 응답에 time2가 정확히 포함되어 있는지 확인
      });
      expect(response.body[2]).toMatchObject({
        id: expect.any(Number),
        senderId: users[0].id,
        content: 'test3',
        sentAt: time3, // 응답에 time3이 정확히 포함되어 있는지 확인
      });

      // 4. DB에서 직접 조회하여 시간이 정확히 저장되었는지 검증
      const savedMessages = await chatMessageRepository.find({
        where: { chatRoom: { id: roomId } },
        order: { sentAt: 'ASC' }, // sentAt 오름차순으로 정렬
      });

      expect(savedMessages).toHaveLength(3);
      // 첫 번째 메시지
      expect(savedMessages[0].content).toEqual('test1');
      expect(savedMessages[0].sentAt.toISOString()).toEqual(time1); // DB 저장 시간 검증

      // 두 번째 메시지
      expect(savedMessages[1].content).toEqual('test2');
      expect(savedMessages[1].sentAt.toISOString()).toEqual(time2); // DB 저장 시간 검증

      // 세 번째 메시지
      expect(savedMessages[2].content).toEqual('test3');
      expect(savedMessages[2].sentAt.toISOString()).toEqual(time3); // DB 저장 시간 검증
    });

    it('F3-1: 비참여자가 메시지 조회 시도', async () => {
      const response = await request(app.getHttpServer())
        .get(`/chat/rooms/${roomId}/messages`)
        .set('Authorization', `Bearer ${accessTokens[2]}`)
        .expect(403);

      expect(response.body).toMatchObject({
        message: CHAT_ERRORS.INVALID_PARTICIPANT,
      });
    });
    it('F3-2: 존재하지 않는 방 ID로 조회 시도', async () => {
      const response = await request(app.getHttpServer())
        .get(`/chat/rooms/999999/messages`)
        .set('Authorization', `Bearer ${accessTokens[0]}`)
        .expect(403);

      expect(response.body).toMatchObject({
        message: CHAT_ERRORS.INVALID_PARTICIPANT,
      });
    });
  });

  describe('DELETE /chat/rooms/:roomId - 채팅방 삭제', () => {
    let roomId: number;

    beforeEach(async () => {
      const createRoomDto: CreateChatRoomDto = {
        name: users[0].name,
        participantIds: [users[1].id],
      };

      const response = await request(app.getHttpServer())
        .post('/chat/rooms')
        .set('Authorization', `Bearer ${accessTokens[0]}`)
        .send(createRoomDto)
        .expect(201);

      expect(response.body).toMatchObject({
        message: 'Chat room created successfully.',
        room: {
          id: expect.any(Number),
          participantIds: [users[0].id, users[1].id],
        },
      });

      roomId = response.body.room.id;
    });

    it('F4-0: 인증되지 않은 참여자가 채팅방 삭제 시도', async () => {
      await request(app.getHttpServer())
        .delete(`/chat/rooms/${roomId}`)
        .expect(401);
    });

    it('S4-1: 방장이 채팅방 삭제', async () => {
      await request(app.getHttpServer())
        .delete(`/chat/rooms/${roomId}`)
        .set('Authorization', `Bearer ${accessTokens[0]}`)
        .expect(204);

      const deleteChatRoom = await chatRoomRepository.findOne({
        where: { id: roomId },
        withDeleted: true,
      });
      expect(deleteChatRoom).toBeDefined();
      expect(deleteChatRoom.deletedAt).not.toBeNull();

      const deletedChatParticipants = await chatParticipantRepository.find({
        where: { chatRoom: { id: roomId } },
        withDeleted: true,
      });
      expect(deletedChatParticipants.length).toBe(2);
      expect(deletedChatParticipants).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            leftAt: expect.any(Date),
          }),
          expect.objectContaining({
            leftAt: expect.any(Date),
          }),
        ]),
      );
    });

    it('F4-1: 일반 참여자가 채팅방 삭제 시도', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/chat/rooms/${roomId}`)
        .set('Authorization', `Bearer ${accessTokens[1]}`)
        .expect(403);

      expect(response.body.message).toEqual(
        CHAT_ERRORS.ONLY_CREATOR_CAN_DELETE,
      );

      const notDeleteChatRoom = await chatRoomRepository.findOne({
        where: { id: roomId },
        withDeleted: true,
      });
      expect(notDeleteChatRoom).toBeDefined();
      expect(notDeleteChatRoom.deletedAt).toBeNull();

      const notDeletedChatParticipants = await chatParticipantRepository.find({
        where: { chatRoom: { id: roomId } },
        withDeleted: true,
      });
      expect(notDeletedChatParticipants.length).toBe(2);
      expect(notDeletedChatParticipants).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            leftAt: null,
          }),
          expect.objectContaining({
            leftAt: null,
          }),
        ]),
      );
    });
    it('F4-2: 존재하지 않는 방 삭제 시도', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/chat/rooms/9999999`)
        .set('Authorization', `Bearer ${accessTokens[1]}`)
        .expect(404);

      expect(response.body.message).toEqual(CHAT_ERRORS.ROOM_NOT_FOUND);
    });
  });

  describe('POST /chat/rooms/:roomId/invite - 사용자 초대', () => {
    let roomId: number;
    let inviteUserDto: InviteUserDto;

    beforeEach(async () => {
      const createRoomDto: CreateChatRoomDto = {
        name: users[0].name,
        participantIds: [users[1].id],
      };

      inviteUserDto = {
        userId: users[4].id,
      };

      const response = await request(app.getHttpServer())
        .post('/chat/rooms')
        .set('Authorization', `Bearer ${accessTokens[0]}`)
        .send(createRoomDto)
        .expect(201);

      expect(response.body).toMatchObject({
        message: 'Chat room created successfully.',
        room: {
          id: expect.any(Number),
          participantIds: [users[0].id, users[1].id],
        },
      });

      roomId = response.body.room.id;
    });

    it('F5-0: 인증되지 않은 참여자가 사용자 초대 시도', async () => {
      await request(app.getHttpServer())
        .post(`/chat/rooms/${roomId}/invite`)
        .send(inviteUserDto)
        .expect(401);
    });

    it('S5-1: 방장이 새로운 사용자 초대', async () => {
      await request(app.getHttpServer())
        .post(`/chat/rooms/${roomId}/invite`)
        .set('Authorization', `Bearer ${accessTokens[0]}`)
        .send(inviteUserDto)
        .expect(204);

      const newParticipant = await chatParticipantRepository.findOne({
        where: { chatRoom: { id: roomId }, user: { id: users[4].id } },
      });
      expect(newParticipant).toBeDefined();
      expect(newParticipant.leftAt).toBeNull();
    });

    it('S5-2: 방장이 나갔던 사용자 재초대', async () => {
      const reInvitedUserDto = { userId: users[1].id };
      await request(app.getHttpServer())
        .delete(`/chat/rooms/${roomId}/users/${users[1].id}`)
        .set('Authorization', `Bearer ${accessTokens[0]}`)
        .expect(204);

      const deletedParticipant = await chatParticipantRepository.findOne({
        where: { chatRoom: { id: roomId }, user: { id: users[1].id } },
        relations: { user: true },
        withDeleted: true,
      });
      expect(deletedParticipant.user.id).toEqual(users[1].id);
      expect(deletedParticipant.leftAt).not.toBeNull();

      await request(app.getHttpServer())
        .post(`/chat/rooms/${roomId}/invite`)
        .set('Authorization', `Bearer ${accessTokens[0]}`)
        .send(reInvitedUserDto)
        .expect(204);

      const reInvitedParticipant = await chatParticipantRepository.findOne({
        where: { chatRoom: { id: roomId }, user: { id: users[1].id } },
      });
      expect(reInvitedParticipant).toBeDefined();
      expect(reInvitedParticipant.leftAt).toBeNull();
    });

    it('F5-1: 일반 참여자가 사용자 초대 시도', async () => {
      const response = await request(app.getHttpServer())
        .post(`/chat/rooms/${roomId}/invite`)
        .set('Authorization', `Bearer ${accessTokens[1]}`)
        .send(inviteUserDto)
        .expect(403);

      expect(response.body.message).toEqual(
        CHAT_ERRORS.ONLY_CREATOR_CAN_INVITE,
      );

      const nonAddedParticipant = await chatParticipantRepository.findOne({
        where: { chatRoom: { id: roomId }, user: { id: users[4].id } },
      });
      expect(nonAddedParticipant).toBeNull();
    });

    it('F5-2: 이미 참여 중인 사용자 초대 시도', async () => {
      const alreadyInvitedUserDto: InviteUserDto = {
        userId: users[1].id,
      };
      const response = await request(app.getHttpServer())
        .post(`/chat/rooms/${roomId}/invite`)
        .set('Authorization', `Bearer ${accessTokens[0]}`)
        .send(alreadyInvitedUserDto)
        .expect(400);

      expect(response.body.message).toEqual(
        CHAT_ERRORS.USER_ALREADY_PARTICIPANT,
      );
    });
    it('F5-3: 존재하지 않는 사용자 초대 시도', async () => {
      const notExistedUserDto: InviteUserDto = {
        userId: 999999,
      };
      const response = await request(app.getHttpServer())
        .post(`/chat/rooms/${roomId}/invite`)
        .set('Authorization', `Bearer ${accessTokens[0]}`)
        .send(notExistedUserDto)
        .expect(400);

      expect(response.body.message).toEqual(CHAT_ERRORS.NON_EXISTED_USER);
    });
  });

  describe('DELETE /chat/rooms/:roomId/users/:userId - 사용자 퇴장', () => {
    let roomId: number;

    beforeEach(async () => {
      const createRoomDto: CreateChatRoomDto = {
        name: users[0].name,
        participantIds: [users[1].id, users[2].id],
      };

      const response = await request(app.getHttpServer())
        .post('/chat/rooms')
        .set('Authorization', `Bearer ${accessTokens[0]}`)
        .send(createRoomDto)
        .expect(201);

      expect(response.body).toMatchObject({
        message: 'Chat room created successfully.',
        room: {
          id: expect.any(Number),
          participantIds: [users[0].id, users[1].id, users[2].id],
        },
      });

      roomId = response.body.room.id;
    });

    it('F6-0: 인증되지 않은 참여자가 다른 사용자 퇴장 시도', async () => {
      await request(app.getHttpServer())
        .delete(`/chat/rooms/${roomId}/users/${users[1].id}`)
        .expect(401);
    });

    it('S6-1: 사용자 본인이 자진 퇴장', async () => {
      await request(app.getHttpServer())
        .delete(`/chat/rooms/${roomId}/users/${users[1].id}`)
        .set('Authorization', `Bearer ${accessTokens[1]}`)
        .expect(204);

      const deletedParticipant = await chatParticipantRepository.findOne({
        where: { chatRoom: { id: roomId }, user: { id: users[1].id } },
        relations: { user: true },
        withDeleted: true,
      });
      expect(deletedParticipant.user.id).toEqual(users[1].id);
      expect(deletedParticipant.leftAt).not.toBeNull();
    });

    it('S6-2: 방장이 다른 사용자 강제 퇴장', async () => {
      await request(app.getHttpServer())
        .delete(`/chat/rooms/${roomId}/users/${users[1].id}`)
        .set('Authorization', `Bearer ${accessTokens[0]}`)
        .expect(204);

      const deletedParticipant = await chatParticipantRepository.findOne({
        where: { chatRoom: { id: roomId }, user: { id: users[1].id } },
        relations: { user: true },
        withDeleted: true,
      });
      expect(deletedParticipant.user.id).toEqual(users[1].id);
      expect(deletedParticipant.leftAt).not.toBeNull();
    });

    it('F6-1: 일반 참여자가 다른 사용자 퇴장 시도', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/chat/rooms/${roomId}/users/${users[1].id}`)
        .set('Authorization', `Bearer ${accessTokens[2]}`)
        .expect(403);

      expect(response.body.message).toEqual(CHAT_ERRORS.CANNOT_REMOVE_USER);

      const notDeletedParticipant = await chatParticipantRepository.findOne({
        where: { chatRoom: { id: roomId }, user: { id: users[1].id } },
        relations: { user: true },
        withDeleted: true,
      });
      expect(notDeletedParticipant.user.id).toEqual(users[1].id);
      expect(notDeletedParticipant.leftAt).toBeNull();
    });

    it('F6-2: 이미 퇴장한 사용자 퇴장 시도', async () => {
      await request(app.getHttpServer())
        .delete(`/chat/rooms/${roomId}/users/${users[1].id}`)
        .set('Authorization', `Bearer ${accessTokens[0]}`)
        .expect(204);

      const response = await request(app.getHttpServer())
        .delete(`/chat/rooms/${roomId}/users/${users[1].id}`)
        .set('Authorization', `Bearer ${accessTokens[0]}`)
        .expect(400);

      expect(response.body.message).toEqual(CHAT_ERRORS.USER_NOT_IN_ROOM);
    });

    it('F6-3: 방장 본인의 퇴장 시도', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/chat/rooms/${roomId}/users/${users[0].id}`)
        .set('Authorization', `Bearer ${accessTokens[0]}`)
        .expect(400);

      expect(response.body.message).toEqual(
        CHAT_ERRORS.CREATOR_CANNOT_SELF_REMOVE,
      );

      const cannotDeletedCreator = await chatParticipantRepository.findOne({
        where: { chatRoom: { id: roomId }, user: { id: users[0].id } },
        relations: { user: true },
        withDeleted: true,
      });
      expect(cannotDeletedCreator.user.id).toEqual(users[0].id);
      expect(cannotDeletedCreator.leftAt).toBeNull();
    });
  });
});
