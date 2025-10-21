// src/vtt/vtt.gateway.e2e-spec.ts
import { INestApplication } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '@/users/entities/user.entity';
import { createUserDto } from '@/users/factory/user.factory';
import { io } from 'socket.io-client';
import { Token } from '@/token/entities/token.entity';
import { VttMap } from '@/vttmap/entities/vttmap.entity';
import { Room } from '@/room/entities/room.entity';
import { RoomParticipant } from '@/room/entities/room-participant.entity';
import { createTokenDto } from '@/token/factory/token.factory';
import { CreateVttMapDto } from '@/vttmap/dto/create-vttmap.dto';
import {
  TOKEN_ERROR_MESSAGES,
  TokenErrorCode,
} from '@/token/constants/token.constants';
import { setupTestApp, signUpAndLogin } from './utils/test.util';
import { GridType } from '@/common/enums/grid-type.enum';
import { RoomService } from '@/room/room.service';
import { TrpgSystem } from '@/common/enums/trpg-system.enum';
import { ParticipantRole } from '@/common/enums/participant-role.enum';
import { VttMapService } from '@/vttmap/vttmap.service';
import { TokenService } from '@/token/token.service';
import { VTTMAP_ERRORS } from '@/vttmap/constants/vttmap.constants';
import * as request from 'supertest';
import { TokenResponseDto } from '@/token/dto/token-response.dto';

// 테스트용 WebSocket 클라이언트 타입
type TestSocket = ReturnType<typeof io> & {
  waitForEvent: (event: string, timeoutMs?: number) => Promise<any>;
};

// WebSocket 클라이언트 생성 헬퍼
function createSocketClient(
  url: string,
  token: string,
  options: Parameters<typeof io>[1] = {},
): TestSocket {
  const socket = io(url, {
    ...options,
    extraHeaders: {
      authorization: `Bearer ${token}`,
    },
    transports: ['websocket'],
  }) as TestSocket;

  socket.waitForEvent = (event: string, timeoutMs = 5000) => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        socket.off(event);
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

function waitForSocketEvent<T>(
  socket: TestSocket,
  event: string,
  timeoutMs = 5000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timeout waiting for event: ${event}`));
    }, timeoutMs);

    const handler = (data: T) => {
      clearTimeout(timeout);
      socket.off(event, handler);
      resolve(data);
    };

    socket.on(event, handler);
  });
}

describe('VttGateway (e2e) - WebSocket', () => {
  let app: INestApplication;
  let module: TestingModule;
  let userRepository: Repository<User>;
  let roomRepository: Repository<Room>;
  let roomParticipantRepository: Repository<RoomParticipant>;
  let vttMapRepository: Repository<VttMap>;
  let tokenRepository: Repository<Token>;
  let roomService: RoomService;
  let vttMapService: VttMapService;
  let tokenService: TokenService;

  let accessTokens: string[];
  let users: User[];

  const userInfos = Array(2)
    .fill('')
    .map(() => createUserDto());

  const GATEWAY_URL = 'http://localhost:11123/vtt';

  beforeAll(async () => {
    const testApp = await setupTestApp();
    ({ app, module } = testApp);

    userRepository = module.get(getRepositoryToken(User));
    roomRepository = module.get(getRepositoryToken(Room));
    roomParticipantRepository = module.get(getRepositoryToken(RoomParticipant));
    roomService = module.get<RoomService>(RoomService);
    vttMapRepository = module.get(getRepositoryToken(VttMap));
    vttMapService = module.get<VttMapService>(VttMapService);
    tokenRepository = module.get(getRepositoryToken(Token));
    tokenService = module.get<TokenService>(TokenService);
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

    expect(accessTokens).toHaveLength(2);
    expect(users).toHaveLength(2);
  });

  beforeEach(async () => {
    await tokenRepository.createQueryBuilder().delete().execute();
    await vttMapRepository.createQueryBuilder().delete().execute();
    await roomParticipantRepository.createQueryBuilder().delete().execute();
    await roomRepository.createQueryBuilder().delete().execute();
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

    it('F-VTT-GW-1: 유효하지 않은 토큰으로 연결 실패', async () => {
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

    it('F-VTT-GW-2: 토큰 없이 연결 시도 실패', async () => {
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

  describe('Map Join & Token Movement', () => {
    let mapId: string;
    let tokenId: string;
    let socketGM: TestSocket;
    let socketPlayer: TestSocket;
    let testRoom: Room;

    beforeEach(async () => {
      const [gmUser, playerUser] = users;
      const [gmToken, playerToken] = accessTokens;

      // 방 생성
      await roomService.createRoom(
        {
          name: 'VttMap Test Room',
          system: TrpgSystem.DND5E,
          password: 'test1234',
          maxParticipants: 5,
        },
        gmUser.id,
      );

      testRoom = await roomRepository.findOne({
        where: { name: 'VttMap Test Room' },
        relations: ['creator', 'participants', 'participants.user'],
      });

      await roomService.updateParticipantRole(
        testRoom.id,
        gmUser.id,
        gmUser.id,
        ParticipantRole.GM,
      );

      await roomService.joinRoom(testRoom.id, playerUser.id, {
        password: 'test1234',
      });

      // 맵 생성
      const createMapDto: CreateVttMapDto = {
        name: 'Test Map',
        imageUrl: 'https://example.com/map.jpg',
        gridSize: 50,
        gridType: GridType.SQUARE,
        showGrid: true,
      };
      const { vttMap } = await vttMapService.createVttMap(
        testRoom.id,
        gmUser.id,
        createMapDto,
      );
      mapId = vttMap.id;

      // 토큰 생성 (GM이 플레이어용 토큰 생성)
      const createDto = createTokenDto({
        name: 'Player Token',
        x: 100,
        y: 200,
        scale: 1.2,
        imageUrl: 'https://example.com/chest.png',
        characterSheetId: null,
      });
      const token = await tokenService.createToken(mapId, createDto, gmUser.id);
      tokenId = token.id;

      // WebSocket 연결 (joinMap은 테스트마다 직접 호출)
      socketGM = createSocketClient(GATEWAY_URL, gmToken);
      socketPlayer = createSocketClient(GATEWAY_URL, playerToken);

      await Promise.all([
        new Promise<void>((resolve) => socketGM.on('connect', resolve)),
        new Promise<void>((resolve) => socketPlayer.on('connect', resolve)),
      ]);

      expect(socketGM.connected).toBe(true);
      expect(socketPlayer.connected).toBe(true);
      await joinRoom(socketGM, testRoom.id);
      await joinRoom(socketPlayer, testRoom.id);
    });

    afterEach(async () => {
      if (socketGM?.connected) {
        socketGM.emit('leaveRoom', { roomId: testRoom.id });
        await socketGM.waitForEvent('leftRoom', 2000).catch(() => {});
      }
      if (socketPlayer?.connected) {
        socketPlayer.emit('leaveRoom', { roomId: testRoom.id });
        await socketPlayer.waitForEvent('leftRoom', 2000).catch(() => {});
      }
      socketGM?.disconnect();
      socketPlayer?.disconnect();
    });

    async function joinMap(socket: TestSocket, mapId: string) {
      socket.emit('joinMap', { mapId });
      await socket.waitForEvent('joinedMap');
    }

    async function leaveMap(socket: TestSocket, mapId: string) {
      socket.emit('leaveMap', { mapId });
      await socket.waitForEvent('leftMap');
    }

    it('S-VTT-GW-2: GM이 맵에 참여하고 토큰 이동 → 플레이어가 실시간으로 수신', async () => {
      await joinMap(socketGM, mapId);
      await joinMap(socketPlayer, mapId);

      socketGM.emit('moveToken', { tokenId, x: 200, y: 200 });
      const updatedToken = await waitForSocketEvent(
        socketPlayer,
        'token:updated',
        5000,
      );

      expect(updatedToken).toMatchObject({ id: tokenId, x: 200, y: 200 });

      const token = await tokenRepository.findOne({ where: { id: tokenId } });
      expect(token.x).toBe(200);
      expect(token.y).toBe(200);
    });

    it('F-VTT-GW-2: 권한 없는 플레이어가 일반 토큰 이동 시도 → error 발생', async () => {
      await joinMap(socketGM, mapId);
      await joinMap(socketPlayer, mapId);

      socketPlayer.emit('moveToken', { tokenId, x: 300, y: 300 });
      const error = await waitForSocketEvent<{ message: string }>(
        socketPlayer,
        'error',
        5000,
      );
      expect(error.message).toBe(
        TOKEN_ERROR_MESSAGES[TokenErrorCode.NO_MOVE_PERMISSION],
      );

      const token = await tokenRepository.findOne({ where: { id: tokenId } });
      expect(token.x).toBe(100);
      expect(token.y).toBe(200);
    });

    it('S-VTT-GW-3: GM이 맵 설정 업데이트 → 플레이어가 실시간 수신', async () => {
      await joinMap(socketGM, mapId);
      await joinMap(socketPlayer, mapId);

      const updates = { gridSize: 60, showGrid: true };
      socketGM.emit('updateMap', { mapId, updates });

      const updated = await waitForSocketEvent(
        socketPlayer,
        'mapUpdated',
        5000,
      );
      expect(updated).toMatchObject({ mapId, gridSize: 60, showGrid: true });
    });

    it('F-VTT-GW-3: 플레이어가 맵 업데이트 시도 → error 발생', async () => {
      await joinMap(socketPlayer, mapId);

      socketPlayer.emit('updateMap', { mapId, updates: { gridSize: 70 } });
      const error = await waitForSocketEvent<{ message: string }>(
        socketPlayer,
        'error',
        5000,
      );
      expect(error.message).toBe(VTTMAP_ERRORS.NOT_ROOM_CREATOR);

      const map = await vttMapRepository.findOne({ where: { id: mapId } });
      expect(map.gridSize).toBe(50);
    });

    it('S-VTT-GW-4: 사용자가 leaveMap 후에는 이벤트 수신 안 함', async () => {
      await joinMap(socketGM, mapId);
      await joinMap(socketPlayer, mapId);

      await leaveMap(socketPlayer, mapId);

      socketGM.emit('moveToken', { tokenId, x: 400, y: 400 });

      await expect(
        waitForSocketEvent(socketPlayer, 'token:updated', 2000),
      ).rejects.toThrow();
    });

    it('S-VTT-GW-5: GM이 REST API로 토큰 생성 → 플레이어가 실시간으로 token:created 수신', async () => {
      await joinMap(socketGM, mapId);
      await joinMap(socketPlayer, mapId);

      const eventPromise = waitForSocketEvent<TokenResponseDto>(
        socketPlayer,
        'token:created',
        10000,
      );

      const createDto = createTokenDto({
        name: 'New Chest',
        x: 300,
        y: 400,
        scale: 1.0,
        imageUrl: 'https://example.com/new-chest.png',
        characterSheetId: null,
      });

      const res = await request(app.getHttpServer())
        .post(`/tokens/maps/${mapId}`)
        .set('Authorization', `Bearer ${accessTokens[0]}`)
        .send(createDto)
        .expect(201);

      const createdToken = await eventPromise;
      expect(createdToken).toMatchObject({
        id: res.body.id,
        mapId,
        name: 'New Chest',
        x: 300,
        y: 400,
        scale: 1.0,
        imageUrl: 'https://example.com/new-chest.png',
        characterSheetId: null,
        npcId: null,
      });

      const tokenFromDB = await tokenRepository.findOne({
        where: { id: res.body.id },
      });
      expect(tokenFromDB).not.toBeNull();
      expect(tokenFromDB!.x).toBe(300);
    });

    it('S-VTT-GW-6: GM이 REST API로 토큰 삭제 → 플레이어가 실시간으로 token:deleted 수신', async () => {
      await joinMap(socketGM, mapId);
      await joinMap(socketPlayer, mapId);

      const eventPromise = waitForSocketEvent<{ id: string }>(
        socketPlayer,
        'token:deleted',
        10000,
      );

      await request(app.getHttpServer())
        .delete(`/tokens/${tokenId}`)
        .set('Authorization', `Bearer ${accessTokens[0]}`)
        .expect(204);

      const deletedEvent = await eventPromise;
      expect(deletedEvent).toMatchObject({ id: tokenId });

      const tokenFromDB = await tokenRepository.findOne({
        where: { id: tokenId },
        withDeleted: true,
      });
      expect(tokenFromDB).not.toBeNull();
      expect(tokenFromDB!.deletedAt).toBeInstanceOf(Date);
    });
  });

  async function joinRoom(socket: TestSocket, roomId: string) {
    console.log(`[TEST] Emitting joinRoom for roomId=${roomId}`);
    socket.emit('joinRoom', { roomId });
    const result = await socket.waitForEvent('joinedRoom', 5000);
    console.log(`[TEST] Received joinedRoom:`, result);
    return result;
  }
  async function joinMap(socket: TestSocket, mapId: string) {
    socket.emit('joinMap', { mapId });
    return socket.waitForEvent('joinedMap');
  }

  describe('Map Lifecycle & State Restoration', () => {
    let socketGM: TestSocket;
    let socketPlayer: TestSocket;
    let testRoom: Room;
    let mapId: string;

    beforeEach(async () => {
      const [gmUser, playerUser] = users;
      const [gmToken, playerToken] = accessTokens;

      // 방 생성 및 설정
      await roomService.createRoom(
        {
          name: 'Lifecycle Test Room',
          system: TrpgSystem.DND5E,
          password: 'test1234',
          maxParticipants: 5,
        },
        gmUser.id,
      );

      testRoom = await roomRepository.findOne({
        where: { name: 'Lifecycle Test Room' },
        relations: ['creator', 'participants', 'participants.user'],
      });

      await roomService.updateParticipantRole(
        testRoom.id,
        gmUser.id,
        gmUser.id,
        ParticipantRole.GM,
      );
      await roomService.joinRoom(testRoom.id, playerUser.id, {
        password: 'test1234',
      });
      console.log('✅ BeforeEach: 방 생성 완료');
      // WebSocket 연결
      socketGM = createSocketClient(GATEWAY_URL, gmToken);
      socketPlayer = createSocketClient(GATEWAY_URL, playerToken);

      await Promise.all([
        new Promise<void>((resolve) => socketGM.on('connect', resolve)),
        new Promise<void>((resolve) => socketPlayer.on('connect', resolve)),
      ]);

      expect(socketGM.connected).toBe(true);
      expect(socketPlayer.connected).toBe(true);
      console.log('✅ BeforeEach: WebSocket 연결 완료');
      await joinRoom(socketGM, testRoom.id);
      await joinRoom(socketPlayer, testRoom.id);
      console.log('✅ BeforeEach: joinRoom 완료');
    }, 15000);

    afterEach(async () => {
      if (socketGM?.connected) {
        socketGM.emit('leaveRoom', { roomId: testRoom.id });
        await socketGM.waitForEvent('leftRoom', 2000).catch(() => {});
      }
      if (socketPlayer?.connected) {
        socketPlayer.emit('leaveRoom', { roomId: testRoom.id });
        await socketPlayer.waitForEvent('leftRoom', 2000).catch(() => {});
      }
      socketGM?.disconnect();
      socketPlayer?.disconnect();
    });

    it('S-VTT-GW-7: joinMap 시 맵 설정과 모든 토큰 목록을 포함한 전체 상태 수신', async () => {
      // 1. 맵 생성
      const { vttMap } = await vttMapService.createVttMap(
        testRoom.id,
        users[0].id,
        {
          name: 'State Map',
          gridSize: 75,
          gridType: GridType.SQUARE,
          showGrid: true,
          imageUrl: 'https://example.com/state-map.jpg',
        },
      );
      mapId = vttMap.id;
      console.log('✅ BeforeEach: 맵 생성 완료');
      // 2. 토큰 생성
      await tokenService.createToken(
        mapId,
        createTokenDto({ name: 'Token A', x: 100, y: 100 }),
        users[0].id,
      );
      await tokenService.createToken(
        mapId,
        createTokenDto({ name: 'Token B', x: 200, y: 200 }),
        users[0].id,
      );

      // 3. 플레이어 join
      const joinedData = await joinMap(socketPlayer, mapId);

      expect(joinedData.mapId).toBe(mapId);
      expect(joinedData.map).toMatchObject({
        id: mapId,
        name: 'State Map',
        gridSize: 75,
        gridType: GridType.SQUARE,
        showGrid: true,
        imageUrl: 'https://example.com/state-map.jpg',
      });
      expect(joinedData.tokens).toHaveLength(2);
      expect(joinedData.tokens.map((t) => t.name)).toContain('Token A');
      expect(joinedData.tokens.map((t) => t.name)).toContain('Token B');
    });

    it('S-VTT-GW-8: GM이 새 맵 생성 → 플레이어가 mapCreated 이벤트 수신', async () => {
      // ✅ 플레이어가 방에 join
      await joinRoom(socketPlayer, testRoom.id);

      const mapCreatedPromise = waitForSocketEvent(
        socketPlayer,
        'mapCreated',
        5000,
      );

      // GM이 새 맵 생성
      const { vttMap } = await vttMapService.createVttMap(
        testRoom.id,
        users[0].id,
        { name: 'New Map from Event', gridSize: 50 },
      );

      const event = await mapCreatedPromise;
      expect(event).toMatchObject({
        id: vttMap.id,
        name: 'New Map from Event',
        gridSize: 50,
      });
    });

    it('S-VTT-GW-9: GM이 맵 삭제 → 플레이어가 mapDeleted 이벤트 수신', async () => {
      // ✅ 플레이어가 방에 join
      await joinRoom(socketPlayer, testRoom.id);

      const { vttMap } = await vttMapService.createVttMap(
        testRoom.id,
        users[0].id,
        { name: 'To Delete Map' },
      );

      // 플레이어는 방에 참여만 함 (맵 join 불필요)
      const mapDeletedPromise = waitForSocketEvent(
        socketPlayer,
        'mapDeleted',
        5000,
      );
      await vttMapService.deleteVttMap(vttMap.id, users[0].id);

      const event = await mapDeletedPromise;
      expect(event).toMatchObject({ id: vttMap.id });
    });

    it('F-VTT-GW-4: 방에 참여하지 않은 사용자가 joinMap 시도 → error 발생', async () => {
      const { vttMap } = await vttMapService.createVttMap(
        testRoom.id,
        users[0].id,
        { name: 'Valid Map' },
      );

      // ✅ 테스트 내부에서만 outsider 생성
      const outsiderToken = await signUpAndLogin(app, createUserDto());
      const socketOutsider = createSocketClient(GATEWAY_URL, outsiderToken);
      await new Promise<void>((resolve) =>
        socketOutsider.on('connect', resolve),
      );
      expect(socketOutsider.connected).toBe(true);

      socketOutsider.emit('joinMap', { mapId: vttMap.id });

      const error = await waitForSocketEvent<{ message: string }>(
        socketOutsider,
        'error',
        5000,
      );
      expect(error.message).toBe('해당 방에 참여하지 않았습니다.');

      socketOutsider.disconnect(); // 테스트 종료 시 해제
    });
    it('S-VTT-GW-10: joinMap 시 Soft Delete된 토큰은 포함되지 않음', async () => {
      const { vttMap } = await vttMapService.createVttMap(
        testRoom.id,
        users[0].id,
        { name: 'Map with Deleted Token' },
      );
      mapId = vttMap.id;

      await tokenService.createToken(
        mapId,
        createTokenDto({ name: 'Active', x: 0, y: 0 }),
        users[0].id,
      );
      const deletedToken = await tokenService.createToken(
        mapId,
        createTokenDto({ name: 'Deleted', x: 100, y: 100 }),
        users[0].id,
      );
      await tokenService.deleteToken(deletedToken.id, users[0].id);

      const joinedData = await joinMap(socketPlayer, mapId);
      const tokenNames = joinedData.tokens.map((t) => t.name);
      expect(tokenNames).toContain('Active');
      expect(tokenNames).not.toContain('Deleted');
      expect(joinedData.tokens).toHaveLength(1);
    });
  });
});
