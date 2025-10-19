import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource, Repository } from 'typeorm';
import { ParticipantRole } from '@/common/enums/participant-role.enum';
import { ROOM_MESSAGES, ROOM_ERRORS } from '@/room/constants/room.constants';
import {
  setupTestApp,
  signUpAndLogin,
  truncateAllTables,
  getAuthHeaders,
  expectErrorResponse,
} from './utils/test.util';
import { createUserDto } from '@/users/factory/user.factory';
import { User } from '@/users/entities/user.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TestingModule } from '@nestjs/testing';
import { TrpgSystem } from '@/common/enums/trpg-system.enum';

describe('Room API (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let module: TestingModule;
  let userRepository: Repository<User>;

  // 테스트 사용자 토큰
  let creatorToken: string;
  let participantToken: string;
  let anotherParticipantToken: string;

  // 테스트 방 정보
  let testRoomId: string;
  const testRoomName = '테스트 방';
  const testRoomPassword = '123';
  const testRoomMaxParticipants = 4;

  const creatorInfo = createUserDto();

  beforeAll(async () => {
    const testApp = await setupTestApp();
    ({ app, module, dataSource } = testApp);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
  }, 30000);

  afterAll(async () => {
    await truncateAllTables(dataSource);
    await app.close();
  });

  beforeEach(async () => {
    await truncateAllTables(dataSource);

    // 테스트 사용자 생성 및 로그인

    const participantInfo = createUserDto();
    const anotherParticipantInfo = createUserDto();

    creatorToken = await signUpAndLogin(app, creatorInfo);
    participantToken = await signUpAndLogin(app, participantInfo);
    anotherParticipantToken = await signUpAndLogin(app, anotherParticipantInfo);
  });

  describe('POST /rooms - 방 생성', () => {
    const validRoomData = {
      system: TrpgSystem.DND5E,
      name: testRoomName,
      password: testRoomPassword,
      maxParticipants: testRoomMaxParticipants,
    };

    it('정상적인 방 생성 - 성공', async () => {
      const response = await request(app.getHttpServer())
        .post('/rooms')
        .set(getAuthHeaders(creatorToken))
        .send(validRoomData)
        .expect(201);

      expect(response.body.message).toBe(ROOM_MESSAGES.CREATED);
      expect(response.body.room).toBeDefined();
      expect(response.body.room.system).toBe(TrpgSystem.DND5E);
      expect(response.body.room.name).toBe(validRoomData.name);
      expect(response.body.room.maxParticipants).toBe(
        validRoomData.maxParticipants,
      );
      expect(response.body.room.currentParticipants).toBe(1);
      expect(response.body.room.participants).toHaveLength(1);
      expect(response.body.room.participants[0].role).toBe(
        ParticipantRole.PLAYER,
      );

      testRoomId = response.body.room.id;
    });

    it('방 이름이 1자 미만일 경우 - 실패', async () => {
      const response = await request(app.getHttpServer())
        .post('/rooms')
        .set(getAuthHeaders(creatorToken))
        .send({ ...validRoomData, name: '' })
        .expect(400);

      // 배열 형식으로 기대값
      expect(response.body.message).toEqual([ROOM_ERRORS.INVALID_ROOM_NAME]);
    });

    it('방 이름이 50자를 초과할 경우 - 실패', async () => {
      const longName = 'a'.repeat(51);
      const response = await request(app.getHttpServer())
        .post('/rooms')
        .set(getAuthHeaders(creatorToken))
        .send({ ...validRoomData, name: longName })
        .expect(400);

      expect(response.body.message).toEqual([
        ROOM_ERRORS.INVALID_ROOM_NAME_LENGTH,
      ]);
    });

    it('비밀번호를 입력하지 않은 경우 - 실패', async () => {
      const response = await request(app.getHttpServer())
        .post('/rooms')
        .set(getAuthHeaders(creatorToken))
        .send({ ...validRoomData, password: '' })
        .expect(400);

      expect(response.body.message).toEqual([ROOM_ERRORS.PASSWORD_REQUIRED]);
    });

    it('최대 참여자 수가 2 미만일 경우 - 실패', async () => {
      const response = await request(app.getHttpServer())
        .post('/rooms')
        .set(getAuthHeaders(creatorToken))
        .send({ ...validRoomData, maxParticipants: 1 })
        .expect(400);

      expect(response.body.message).toEqual([
        ROOM_ERRORS.INVALID_MAX_PARTICIPANTS_MIN,
      ]);
    });

    it('최대 참여자 수가 8 초과일 경우 - 실패', async () => {
      const response = await request(app.getHttpServer())
        .post('/rooms')
        .set(getAuthHeaders(creatorToken))
        .send({ ...validRoomData, maxParticipants: 9 })
        .expect(400);

      expect(response.body.message).toEqual([
        ROOM_ERRORS.INVALID_MAX_PARTICIPANTS_MAX,
      ]);
    });

    it('이미 다른 방에 참가한 사용자가 방 생성 시도 - 실패', async () => {
      // 먼저 방 생성
      await request(app.getHttpServer())
        .post('/rooms')
        .set(getAuthHeaders(creatorToken))
        .send(validRoomData)
        .expect(201);

      // 같은 사용자가 다시 방 생성 시도
      const response = await request(app.getHttpServer())
        .post('/rooms')
        .set(getAuthHeaders(creatorToken))
        .send(validRoomData)
        .expect(409);

      expectErrorResponse(response, 409, ROOM_ERRORS.ALREADY_IN_ROOM);
    });

    it('인증되지 않은 사용자가 방 생성 시도 - 실패', async () => {
      const response = await request(app.getHttpServer())
        .post('/rooms')
        .send(validRoomData)
        .expect(401);

      expectErrorResponse(response, 401, 'Unauthorized');
    });
  });

  describe('POST /rooms/:roomId/join - 방 참가', () => {
    beforeEach(async () => {
      // 방 생성 (creatorToken 사용)
      const response = await request(app.getHttpServer())
        .post('/rooms')
        .set(getAuthHeaders(creatorToken))
        .send({
          system: TrpgSystem.DND5E,
          name: testRoomName,
          password: testRoomPassword,
          maxParticipants: testRoomMaxParticipants,
        })
        .expect(201);

      testRoomId = response.body.room.id;
    });

    it('정상적인 방 참가 - 성공', async () => {
      const response = await request(app.getHttpServer())
        .post(`/rooms/${testRoomId}/join`)
        .set(getAuthHeaders(participantToken))
        .send({ password: testRoomPassword })
        .expect(200);

      expect(response.body.message).toBe(ROOM_MESSAGES.JOINED);
      expect(response.body.room.currentParticipants).toBe(2);
      expect(response.body.room.participants).toHaveLength(2);
    });

    it('비밀번호 불일치 - 실패', async () => {
      const response = await request(app.getHttpServer())
        .post(`/rooms/${testRoomId}/join`)
        .set(getAuthHeaders(participantToken))
        .send({ password: 'wrong_password' })
        .expect(400);

      expectErrorResponse(response, 400, ROOM_ERRORS.PASSWORD_MISMATCH);
    });

    it('방이 꽉 찬 경우 - 실패 (검증 강화)', async () => {
      // 방이 꽉 찰 때까지 참가
      for (let i = 0; i < testRoomMaxParticipants - 1; i++) {
        const userInfo = createUserDto();
        const token = await signUpAndLogin(app, userInfo);

        await request(app.getHttpServer())
          .post(`/rooms/${testRoomId}/join`)
          .set(getAuthHeaders(token))
          .send({ password: testRoomPassword })
          .expect(200);
      }

      // 방이 실제로 꽉 찼는지 확인
      const roomResponse = await request(app.getHttpServer())
        .get(`/rooms/${testRoomId}`)
        .set(getAuthHeaders(creatorToken))
        .expect(200);

      expect(roomResponse.body.currentParticipants).toBe(
        testRoomMaxParticipants,
      );
      expect(roomResponse.body.participants).toHaveLength(
        testRoomMaxParticipants,
      );

      // 꽉 찬 방에 참가 시도
      const response = await request(app.getHttpServer())
        .post(`/rooms/${testRoomId}/join`)
        .set(getAuthHeaders(anotherParticipantToken))
        .send({ password: testRoomPassword })
        .expect(400);

      expectErrorResponse(response, 400, ROOM_ERRORS.ROOM_FULL);
    });

    it('존재하지 않는 방 ID로 참가 시도 - 실패', async () => {
      // 유효한 UUID 형식이지만 실제 데이터베이스에 없는 UUID 생성
      const nonExistentRoomId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

      const response = await request(app.getHttpServer())
        .post(`/rooms/${nonExistentRoomId}/join`)
        .set(getAuthHeaders(participantToken))
        .send({ password: testRoomPassword })
        .expect(404);

      expectErrorResponse(response, 404, ROOM_ERRORS.NOT_FOUND);
    });

    it('유효하지 않은 방 ID 형식으로 참가 시도 - 실패', async () => {
      const response = await request(app.getHttpServer())
        .post('/rooms/invalid-uuid/join')
        .set(getAuthHeaders(participantToken))
        .send({ password: testRoomPassword })
        .expect(400);

      // NestJS에서 자동 생성하는 메시지 확인
      expect(response.body.message).toContain(
        'Validation failed (uuid is expected)',
      );
    });

    it('이미 다른 방에 참가한 사용자가 새로운 방 참가 시도 - 실패', async () => {
      // 먼저 다른 방 생성
      await request(app.getHttpServer())
        .post('/rooms')
        .set(getAuthHeaders(participantToken))
        .send({
          name: '다른 방',
          password: '456',
        })
        .expect(201);

      // 기존 방에 참가 시도
      const response = await request(app.getHttpServer())
        .post(`/rooms/${testRoomId}/join`)
        .set(getAuthHeaders(participantToken))
        .send({ password: testRoomPassword })
        .expect(409);

      expectErrorResponse(response, 409, ROOM_ERRORS.ALREADY_IN_ROOM);
    });

    it('비밀번호 미입력 - 실패', async () => {
      const response = await request(app.getHttpServer())
        .post(`/rooms/${testRoomId}/join`)
        .set(getAuthHeaders(participantToken))
        .send({ password: '' })
        .expect(400);

      // 따로 배열로 받도록 수정
      expect(response.body.message).toEqual([ROOM_ERRORS.PASSWORD_REQUIRED]);
    });
  });

  describe('방 참가 시 방 삭제와의 동시성 문제', () => {
    it('방 삭제 중 방 참가 시도 - 실패 (ROOM_JOIN_CONFLICT)', async () => {
      // 1. 방 생성
      const createResponse = await request(app.getHttpServer())
        .post('/rooms')
        .set(getAuthHeaders(creatorToken))
        .send({
          name: testRoomName,
          password: testRoomPassword,
          maxParticipants: testRoomMaxParticipants,
        })
        .expect(201);

      const roomId = createResponse.body.room.id;

      // 1. 방 삭제 요청을 시작하지만 완료는 기다리지 않음
      const deletePromise = request(app.getHttpServer())
        .delete(`/rooms/${roomId}`)
        .set(getAuthHeaders(creatorToken))
        .then((res) => res)
        .catch((err) => err.response);

      // 2. 방 삭제 요청이 트랜잭션을 시작할 시간을 주기 위해 아주 짧게 대기 (1ms)
      await new Promise((resolve) => setTimeout(resolve, 1));

      // 3. 방 참가 요청 전송
      const joinResponse = await request(app.getHttpServer())
        .post(`/rooms/${roomId}/join`)
        .set(getAuthHeaders(participantToken))
        .send({ password: testRoomPassword })
        .then((res) => res)
        .catch((err) => err.response);

      // 4. 방 삭제 요청 완료 대기
      const deleteResponse = await deletePromise;

      // 5. 검증
      expect(deleteResponse.status).toBe(204);
      expect(joinResponse.status).toBe(409);
      expect(joinResponse.body.message).toBe(ROOM_ERRORS.ROOM_JOIN_CONFLICT);
    });
  });

  describe('POST /rooms/:roomId/leave - 방 나가기', () => {
    beforeEach(async () => {
      // 방 생성 및 2명 참가
      const response = await request(app.getHttpServer())
        .post('/rooms')
        .set(getAuthHeaders(creatorToken))
        .send({
          system: TrpgSystem.DND5E,
          name: testRoomName,
          password: testRoomPassword,
          maxParticipants: testRoomMaxParticipants,
        })
        .expect(201);

      testRoomId = response.body.room.id;

      // 참가자 1명 추가
      await request(app.getHttpServer())
        .post(`/rooms/${testRoomId}/join`)
        .set(getAuthHeaders(participantToken))
        .send({ password: testRoomPassword })
        .expect(200);
    });

    it('일반 참여자 방 나가기 - 성공', async () => {
      await request(app.getHttpServer())
        .post(`/rooms/${testRoomId}/leave`)
        .set(getAuthHeaders(participantToken))
        .expect(204);
    });

    it('방장이 직접 나가기 시도 - 실패', async () => {
      const response = await request(app.getHttpServer())
        .post(`/rooms/${testRoomId}/leave`)
        .set(getAuthHeaders(creatorToken))
        .expect(403);

      expectErrorResponse(response, 403, ROOM_ERRORS.CANNOT_LEAVE_AS_CREATOR);
    });

    it('존재하지 않는 방 ID로 나가기 시도 - 성공 (멱등성 보장)', async () => {
      // 유효한 UUID 형식이지만 실제 데이터베이스에 없는 UUID 생성
      const nonExistentRoomId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

      await request(app.getHttpServer())
        .post(`/rooms/${nonExistentRoomId}/leave`)
        .set(getAuthHeaders(participantToken))
        .expect(204);
    });

    it('유효하지 않은 방 ID 형식으로 나가기 시도 - 실패', async () => {
      const response = await request(app.getHttpServer())
        .post('/rooms/invalid-uuid/leave')
        .set(getAuthHeaders(participantToken))
        .expect(400);

      // NestJS에서 자동 생성하는 메시지 확인
      expect(response.body.message).toContain(
        'Validation failed (uuid is expected)',
      );
    });

    it('이미 나간 방을 다시 나가려고 시도 - 성공 (멱등성 보장)', async () => {
      // 먼저 나가기
      await request(app.getHttpServer())
        .post(`/rooms/${testRoomId}/leave`)
        .set(getAuthHeaders(participantToken))
        .expect(204);

      // 다시 나가기 시도
      await request(app.getHttpServer())
        .post(`/rooms/${testRoomId}/leave`)
        .set(getAuthHeaders(participantToken))
        .expect(204);
    });
    it('멱등성 검증 - 방 나가기 (다중 호출)', async () => {
      // 1. 방 나가기 요청
      await request(app.getHttpServer())
        .post(`/rooms/${testRoomId}/leave`)
        .set(getAuthHeaders(participantToken))
        .expect(204);

      // 2. 이미 나간 사용자가 다시 나가기 요청 (멱등성 보장)
      await request(app.getHttpServer())
        .post(`/rooms/${testRoomId}/leave`)
        .set(getAuthHeaders(participantToken))
        .expect(204);

      // 방 정보 조회
      const roomResponse = await request(app.getHttpServer())
        .get(`/rooms/${testRoomId}`)
        .set(getAuthHeaders(creatorToken))
        .expect(200);

      const roomId = roomResponse.body.id;
      expect(roomId).toBeDefined();

      // 4. 방장 닉네임 확인 (creatorNickname 필드 사용)
      const creator = await userRepository.findOne({
        where: { createdRoom: { id: testRoomId } },
        relations: { createdRoom: true },
      });

      expect(creator.nickname).toBe(creatorInfo.nickname);

      // 5. 참여자 수가 1명(방장만)으로 줄어들었는지 확인
      expect(roomResponse.body.currentParticipants).toBe(1);
      expect(roomResponse.body.participants).toHaveLength(1);
      expect(roomResponse.body.participants[0].nickname).toBe(
        creatorInfo.nickname,
      );
    });
  });

  describe('DELETE /rooms/:roomId - 방 삭제', () => {
    beforeEach(async () => {
      // 방 생성
      const response = await request(app.getHttpServer())
        .post('/rooms')
        .set(getAuthHeaders(creatorToken))
        .send({
          system: TrpgSystem.DND5E,
          name: testRoomName,
          password: testRoomPassword,
          maxParticipants: testRoomMaxParticipants,
        })
        .expect(201);

      testRoomId = response.body.room.id;
    });

    it('방장이 방 삭제 - 성공', async () => {
      await request(app.getHttpServer())
        .delete(`/rooms/${testRoomId}`)
        .set(getAuthHeaders(creatorToken))
        .expect(204);
    });

    it('방장이 아닌 사용자가 방 삭제 시도 - 실패', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/rooms/${testRoomId}`)
        .set(getAuthHeaders(participantToken))
        .expect(403);

      expectErrorResponse(response, 403, ROOM_ERRORS.NOT_ROOM_CREATOR);
    });

    it('존재하지 않는 방 ID로 삭제 시도 - 성공 (멱등성 보장)', async () => {
      // 유효한 UUID 형식이지만 실제 데이터베이스에 없는 UUID 생성
      const nonExistentRoomId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

      await request(app.getHttpServer())
        .delete(`/rooms/${nonExistentRoomId}`)
        .set(getAuthHeaders(creatorToken))
        .expect(204);
    });

    it('유효하지 않은 방 ID 형식으로 삭제 시도 - 실패', async () => {
      const response = await request(app.getHttpServer())
        .delete('/rooms/invalid-uuid')
        .set(getAuthHeaders(creatorToken))
        .expect(400);

      // NestJS에서 자동 생성하는 메시지 확인
      expect(response.body.message).toContain(
        'Validation failed (uuid is expected)',
      );
    });

    it('이미 삭제된 방을 다시 삭제 - 성공 (멱등성 보장)', async () => {
      // 먼저 삭제
      await request(app.getHttpServer())
        .delete(`/rooms/${testRoomId}`)
        .set(getAuthHeaders(creatorToken))
        .expect(204);

      // 다시 삭제 시도
      await request(app.getHttpServer())
        .delete(`/rooms/${testRoomId}`)
        .set(getAuthHeaders(creatorToken))
        .expect(204);
    });
  });

  describe('PATCH /rooms/:roomId/transfer-creator - 방장 위임', () => {
    let participantUserId: number;

    beforeEach(async () => {
      // 방 생성
      const response = await request(app.getHttpServer())
        .post('/rooms')
        .set(getAuthHeaders(creatorToken))
        .send({
          system: TrpgSystem.DND5E,
          name: testRoomName,
          password: testRoomPassword,
          maxParticipants: testRoomMaxParticipants,
        })
        .expect(201);

      testRoomId = response.body.room.id;

      // 참가자 1명 추가
      const joinResponse = await request(app.getHttpServer())
        .post(`/rooms/${testRoomId}/join`)
        .set(getAuthHeaders(participantToken))
        .send({ password: testRoomPassword })
        .expect(200);

      participantUserId = joinResponse.body.room.participants[1].id;
    });

    it('정상적인 방장 위임 - 성공', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/rooms/${testRoomId}/transfer-creator`)
        .set(getAuthHeaders(creatorToken))
        .send({ newCreatorId: participantUserId })
        .expect(200);

      expect(response.body.message).toBe(ROOM_MESSAGES.CREATOR_TRANSFERRED);
      expect(response.body.room.participants).toContainEqual(
        expect.objectContaining({
          id: participantUserId,
          role: ParticipantRole.PLAYER,
        }),
      );
    });

    it('자신에게 위임 시도 - 실패 (검증 강화)', async () => {
      // 1. 정상적인 방장 위임
      const transferResponse = await request(app.getHttpServer())
        .patch(`/rooms/${testRoomId}/transfer-creator`)
        .set(getAuthHeaders(creatorToken))
        .send({ newCreatorId: participantUserId })
        .expect(200);

      // 2. 위임이 성공했는지 확인
      expect(transferResponse.body.message).toBe(
        ROOM_MESSAGES.CREATOR_TRANSFERRED,
      );
      expect(transferResponse.body.room.participants).toContainEqual(
        expect.objectContaining({
          id: participantUserId,
          role: ParticipantRole.PLAYER,
        }),
      );

      // 3. 새로운 방장 확인
      const roomResponse = await request(app.getHttpServer())
        .get(`/rooms/${testRoomId}`)
        .set(getAuthHeaders(participantToken))
        .expect(200);

      // 방장이 변경되었는지 확인 (creatorId가 participantUserId와 일치하는지)
      // (참고: 실제 API 응답 구조에 따라 이 부분을 조정해야 함)
      const newCreator = roomResponse.body.participants.find(
        (p) => p.role === ParticipantRole.PLAYER && p.id === participantUserId,
      );
      expect(newCreator).toBeDefined();

      // 4. 새로운 방장이 자신에게 다시 위임 시도
      const newResponse = await request(app.getHttpServer())
        .patch(`/rooms/${testRoomId}/transfer-creator`)
        .set(getAuthHeaders(participantToken))
        .send({ newCreatorId: participantUserId })
        .expect(400);

      expectErrorResponse(
        newResponse,
        400,
        ROOM_ERRORS.CANNOT_TRANSFER_TO_SELF,
      );
    });

    it('방에 참가하지 않은 사용자에게 위임 시도 - 실패', async () => {
      // 다른 사용자의 ID로 위임 시도 (실제로 존재하지 않는 ID 사용)
      const response = await request(app.getHttpServer())
        .patch(`/rooms/${testRoomId}/transfer-creator`)
        .set(getAuthHeaders(creatorToken))
        .send({ newCreatorId: 99999 })
        .expect(400);

      expectErrorResponse(response, 400, ROOM_ERRORS.TARGET_NOT_IN_ROOM);
    });

    it('방장이 아닌 사용자가 위임 시도 - 실패', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/rooms/${testRoomId}/transfer-creator`)
        .set(getAuthHeaders(participantToken))
        .send({ newCreatorId: participantUserId })
        .expect(403);

      expectErrorResponse(response, 403, ROOM_ERRORS.NOT_ROOM_CREATOR);
    });
  });

  describe('PATCH /rooms/:roomId/participants/:userId/role - 참여자 역할 변경', () => {
    let participantUserId: number;

    beforeEach(async () => {
      // 방 생성
      const response = await request(app.getHttpServer())
        .post('/rooms')
        .set(getAuthHeaders(creatorToken))
        .send({
          system: TrpgSystem.DND5E,
          name: testRoomName,
          password: testRoomPassword,
          maxParticipants: testRoomMaxParticipants,
        })
        .expect(201);

      testRoomId = response.body.room.id;

      // 참가자 1명 추가
      const joinResponse = await request(app.getHttpServer())
        .post(`/rooms/${testRoomId}/join`)
        .set(getAuthHeaders(participantToken))
        .send({ password: testRoomPassword })
        .expect(200);

      participantUserId = joinResponse.body.room.participants[1].id;
    });

    it('정상적인 역할 변경 (PLAYER -> GM) - 성공', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/rooms/${testRoomId}/participants/${participantUserId}/role`)
        .set(getAuthHeaders(creatorToken))
        .send({ role: ParticipantRole.GM })
        .expect(200);

      expect(response.body.message).toBe(ROOM_MESSAGES.ROLE_UPDATED);
      expect(response.body.room.participants).toContainEqual(
        expect.objectContaining({
          id: participantUserId,
          role: ParticipantRole.GM,
        }),
      );
    });

    it('정상적인 역할 변경 (GM -> PLAYER) - 성공', async () => {
      // 1. 먼저 PLAYER를 GM으로 변경
      await request(app.getHttpServer())
        .patch(`/rooms/${testRoomId}/participants/${participantUserId}/role`)
        .set(getAuthHeaders(creatorToken))
        .send({ role: ParticipantRole.GM })
        .expect(200);

      // 2. GM을 다시 PLAYER로 변경
      const response = await request(app.getHttpServer())
        .patch(`/rooms/${testRoomId}/participants/${participantUserId}/role`)
        .set(getAuthHeaders(creatorToken))
        .send({ role: ParticipantRole.PLAYER })
        .expect(200);

      expect(response.body.message).toBe(ROOM_MESSAGES.ROLE_UPDATED);
      expect(response.body.room.participants).toContainEqual(
        expect.objectContaining({
          id: participantUserId,
          role: ParticipantRole.PLAYER,
        }),
      );
    });

    it('역할 변경 후 방 정보를 다시 조회했을 때도 GM으로 표시되어야 함', async () => {
      await request(app.getHttpServer())
        .patch(`/rooms/${testRoomId}/participants/${participantUserId}/role`)
        .set(getAuthHeaders(creatorToken))
        .send({ role: ParticipantRole.GM })
        .expect(200);

      const getResponse = await request(app.getHttpServer())
        .get(`/rooms/${testRoomId}`)
        .set(getAuthHeaders(creatorToken))
        .expect(200);

      // 3. GM으로 표시되는지 확인
      const targetParticipant = getResponse.body.participants.find(
        (p) => p.id === participantUserId,
      );
      expect(targetParticipant).toBeDefined();
      expect(targetParticipant.role).toBe(ParticipantRole.GM);
    });

    it('역할 변경 후 참여자 목록 조회 시에도 GM으로 표시되어야 함', async () => {
      // 1. 역할 변경
      await request(app.getHttpServer())
        .patch(`/rooms/${testRoomId}/participants/${participantUserId}/role`)
        .set(getAuthHeaders(creatorToken))
        .send({ role: ParticipantRole.GM })
        .expect(200);

      // 2. 참여자 목록 조회
      const participantsResponse = await request(app.getHttpServer())
        .get(`/rooms/${testRoomId}/participants`)
        .set(getAuthHeaders(creatorToken))
        .expect(200);

      expect(participantsResponse.body).toContainEqual(
        expect.objectContaining({
          id: participantUserId,
          role: ParticipantRole.GM,
        }),
      );
    });

    it('다양한 유효하지 않은 역할 값으로 변경 시도 - 실패', async () => {
      const invalidRoleCases = [
        { role: null, expectedMessage: ROOM_ERRORS.INVALID_PARTICIPANT_ROLE },
        {
          role: undefined,
          expectedMessage: ROOM_ERRORS.INVALID_PARTICIPANT_ROLE,
        },
        {
          role: 'INVALID',
          expectedMessage: ROOM_ERRORS.INVALID_PARTICIPANT_ROLE,
        },
        { role: '', expectedMessage: ROOM_ERRORS.INVALID_PARTICIPANT_ROLE },
        { role: 123, expectedMessage: ROOM_ERRORS.INVALID_PARTICIPANT_ROLE },
        { role: [], expectedMessage: ROOM_ERRORS.INVALID_PARTICIPANT_ROLE },
        { role: {}, expectedMessage: ROOM_ERRORS.INVALID_PARTICIPANT_ROLE },
      ];

      for (const testCase of invalidRoleCases) {
        const response = await request(app.getHttpServer())
          .patch(`/rooms/${testRoomId}/participants/${participantUserId}/role`)
          .set(getAuthHeaders(creatorToken))
          .send({ role: testCase.role })
          .expect(400);

        expect(response.body.message).toContain(testCase.expectedMessage);
      }
    });

    it('방장이 아닌 사용자가 역할 변경 시도 - 실패', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/rooms/${testRoomId}/participants/${participantUserId}/role`)
        .set(getAuthHeaders(participantToken))
        .send({ role: ParticipantRole.GM })
        .expect(403);

      expectErrorResponse(response, 403, ROOM_ERRORS.NOT_ROOM_CREATOR);
    });

    it('방에 참가하지 않은 사용자의 역할 변경 시도 - 실패', async () => {
      // 다른 사용자의 ID로 역할 변경 시도 (실제로 존재하지 않는 ID 사용)
      const response = await request(app.getHttpServer())
        .patch(`/rooms/${testRoomId}/participants/99999/role`)
        .set(getAuthHeaders(creatorToken))
        .send({ role: ParticipantRole.GM })
        .expect(400);

      expectErrorResponse(response, 400, ROOM_ERRORS.TARGET_NOT_IN_ROOM);
    });
    it('유효하지 않은 역할 값으로 변경 시도 - 실패', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/rooms/${testRoomId}/participants/${participantUserId}/role`)
        .set(getAuthHeaders(creatorToken))
        .send({ role: 'INVALID_ROLE' })
        .expect(400);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain(
        ROOM_ERRORS.INVALID_PARTICIPANT_ROLE,
      );
    });
  });

  describe('GET /rooms/:roomId - 방 정보 조회', () => {
    beforeEach(async () => {
      // 방 생성
      const response = await request(app.getHttpServer())
        .post('/rooms')
        .set(getAuthHeaders(creatorToken))
        .send({
          system: TrpgSystem.DND5E,
          name: testRoomName,
          password: testRoomPassword,
          maxParticipants: testRoomMaxParticipants,
        })
        .expect(201);

      testRoomId = response.body.room.id;

      // 참가자 1명 추가
      await request(app.getHttpServer())
        .post(`/rooms/${testRoomId}/join`)
        .set(getAuthHeaders(participantToken))
        .send({ password: testRoomPassword })
        .expect(200);
    });

    it('정상적인 방 정보 조회 - 성공', async () => {
      const response = await request(app.getHttpServer())
        .get(`/rooms/${testRoomId}`)
        .set(getAuthHeaders(creatorToken))
        .expect(200);

      expect(response.body).toMatchObject({
        id: testRoomId,
        system: TrpgSystem.DND5E,
        name: testRoomName,
        maxParticipants: testRoomMaxParticipants,
        currentParticipants: 2,
        participants: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(Number),
            role: ParticipantRole.PLAYER,
          }),
        ]),
      });
    });

    it('응답에 creatorId가 포함되고, 방장의 실제 ID와 일치해야 함', async () => {
      const response = await request(app.getHttpServer())
        .get(`/rooms/${testRoomId}`)
        .set(getAuthHeaders(creatorToken))
        .expect(200);

      expect(response.body).toHaveProperty('creatorId');
      expect(typeof response.body.creatorId).toBe('number');

      const creator = await userRepository.findOne({
        where: { createdRoom: { id: testRoomId } },
        relations: { createdRoom: true },
      });

      expect(response.body.creatorId).toBe(creator.id);
      expect(response.body.creatorNickname).toBe(creator.nickname);
    });

    it('존재하지 않는 방 ID로 조회 시도 - 실패', async () => {
      // 유효한 UUID 형식이지만 실제 데이터베이스에 없는 UUID 생성
      const nonExistentRoomId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

      const response = await request(app.getHttpServer())
        .get(`/rooms/${nonExistentRoomId}`)
        .set(getAuthHeaders(creatorToken))
        .expect(404);

      expectErrorResponse(response, 404, ROOM_ERRORS.NOT_FOUND);
    });

    it('유효하지 않은 방 ID 형식으로 조회 시도 - 실패', async () => {
      const response = await request(app.getHttpServer())
        .get('/rooms/invalid-uuid')
        .set(getAuthHeaders(creatorToken))
        .expect(400);

      expect(response.body.message).toContain(
        'Validation failed (uuid is expected)',
      );
    });

    it('인증되지 않은 사용자가 방 정보 조회 - 실패', async () => {
      const response = await request(app.getHttpServer())
        .get(`/rooms/${testRoomId}`)
        .expect(401);

      expectErrorResponse(response, 401, 'Unauthorized');
    });
  });

  describe('GET /rooms/:roomId/participants - 참여자 목록 조회', () => {
    let roomId: string;

    beforeEach(async () => {
      // 방 생성
      const createResponse = await request(app.getHttpServer())
        .post('/rooms')
        .set(getAuthHeaders(creatorToken))
        .send({
          system: TrpgSystem.DND5E,
          name: '참여자 테스트 방',
          password: '123',
          maxParticipants: 4,
        })
        .expect(201);

      roomId = createResponse.body.room.id;

      // 참가자 추가
      await request(app.getHttpServer())
        .post(`/rooms/${roomId}/join`)
        .set(getAuthHeaders(participantToken))
        .send({ password: '123' })
        .expect(200);
    });

    it('정상적인 참여자 목록 조회 - 성공', async () => {
      const response = await request(app.getHttpServer())
        .get(`/rooms/${roomId}/participants`)
        .set(getAuthHeaders(creatorToken))
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toMatchObject({
        id: expect.any(Number),
        nickname: expect.any(String),
        role: ParticipantRole.PLAYER,
      });
      expect(response.body[1]).toMatchObject({
        id: expect.any(Number),
        nickname: expect.any(String),
        role: ParticipantRole.PLAYER,
      });
    });

    it('존재하지 않는 방 ID로 조회 시도 - 실패', async () => {
      const nonExistentRoomId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
      const response = await request(app.getHttpServer())
        .get(`/rooms/${nonExistentRoomId}/participants`)
        .set(getAuthHeaders(creatorToken))
        .expect(404);

      expectErrorResponse(response, 404, ROOM_ERRORS.NOT_FOUND);
    });

    it('유효하지 않은 방 ID 형식으로 조회 시도 - 실패', async () => {
      const response = await request(app.getHttpServer())
        .get('/rooms/invalid-uuid/participants')
        .set(getAuthHeaders(creatorToken))
        .expect(400);

      expect(response.body.message).toContain(
        'Validation failed (uuid is expected)',
      );
    });

    it('인증되지 않은 사용자가 조회 시도 - 실패', async () => {
      const response = await request(app.getHttpServer())
        .get(`/rooms/${roomId}/participants`)
        .expect(401);

      expectErrorResponse(response, 401, 'Unauthorized');
    });
  });

  describe('특수 시나리오 테스트', () => {
    it('방 생성 → 방장 위임 → 방 삭제 - 성공', async () => {
      // 1. 방 생성
      const createResponse = await request(app.getHttpServer())
        .post('/rooms')
        .set(getAuthHeaders(creatorToken))
        .send({
          name: testRoomName,
          password: testRoomPassword,
          maxParticipants: testRoomMaxParticipants,
        })
        .expect(201);

      const roomId = createResponse.body.room.id;

      // 2. 참가자 추가
      const joinResponse = await request(app.getHttpServer())
        .post(`/rooms/${roomId}/join`)
        .set(getAuthHeaders(participantToken))
        .send({ password: testRoomPassword })
        .expect(200);

      const participantUserId = joinResponse.body.room.participants[1].id;

      // 3. 방장 위임
      await request(app.getHttpServer())
        .patch(`/rooms/${roomId}/transfer-creator`)
        .set(getAuthHeaders(creatorToken))
        .send({ newCreatorId: participantUserId })
        .expect(200);

      // 4. 새로운 방장으로 방 삭제
      await request(app.getHttpServer())
        .delete(`/rooms/${roomId}`)
        .set(getAuthHeaders(participantToken))
        .expect(204);
    });

    it('방 생성 → 방 참가(가득 찰 때까지) → 방장 위임 → 방장 나가기 - 성공', async () => {
      // 1. 방 생성 (최대 인원 2명)
      const createResponse = await request(app.getHttpServer())
        .post('/rooms')
        .set(getAuthHeaders(creatorToken))
        .send({
          name: testRoomName,
          password: testRoomPassword,
          maxParticipants: 2,
        })
        .expect(201);

      const roomId = createResponse.body.room.id;

      // 2. 참가자 추가
      await request(app.getHttpServer())
        .post(`/rooms/${roomId}/join`)
        .set(getAuthHeaders(participantToken))
        .send({ password: testRoomPassword })
        .expect(200);

      // 3. 방장 위임
      const participantUserId = (
        await request(app.getHttpServer())
          .get(`/rooms/${roomId}`)
          .set(getAuthHeaders(creatorToken))
          .expect(200)
      ).body.participants[1].id;

      await request(app.getHttpServer())
        .patch(`/rooms/${roomId}/transfer-creator`)
        .set(getAuthHeaders(creatorToken))
        .send({ newCreatorId: participantUserId })
        .expect(200);

      // 4. 기존 방장(creatorToken)이 방 나가기
      await request(app.getHttpServer())
        .post(`/rooms/${roomId}/leave`)
        .set(getAuthHeaders(creatorToken))
        .expect(204);
    });

    it('방 삭제 후 방장이 새 방 생성 가능 - 성공', async () => {
      // 1. 방 생성
      const createResponse = await request(app.getHttpServer())
        .post('/rooms')
        .set(getAuthHeaders(creatorToken))
        .send({
          name: testRoomName,
          password: testRoomPassword,
          maxParticipants: testRoomMaxParticipants,
        })
        .expect(201);

      const roomId = createResponse.body.room.id;

      // 2. 방 삭제
      await request(app.getHttpServer())
        .delete(`/rooms/${roomId}`)
        .set(getAuthHeaders(creatorToken))
        .expect(204);

      // 3. 방장이 새 방 생성 가능 확인 (핵심 비즈니스 로직)
      const newRoomResponse = await request(app.getHttpServer())
        .post('/rooms')
        .set(getAuthHeaders(creatorToken))
        .send({
          name: '새로운 방',
          password: testRoomPassword,
          maxParticipants: testRoomMaxParticipants,
        })
        .expect(201);

      expect(newRoomResponse.body.message).toBe(ROOM_MESSAGES.CREATED);
    });
  });
});
