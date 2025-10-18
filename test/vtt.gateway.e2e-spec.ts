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

      // 3. 맵 생성 (GM만 가능)
      const createMapDto: CreateVttMapDto = {
        name: 'Test Map',
        imageUrl: 'https://example.com/map.jpg',
        gridSize: 50,
        gridType: GridType.SQUARE,
        showGrid: true,
      };
      // 4. VTT Map 생성
      const { vttMap } = await vttMapService.createVttMap(
        testRoom.id,
        gmUser.id,
        createMapDto,
      );

      mapId = vttMap.id;

      // 4. 토큰 생성 (GM이 플레이어용 토큰 생성)
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

      // 5. WebSocket 연결
      socketGM = createSocketClient(GATEWAY_URL, gmToken);
      socketPlayer = createSocketClient(GATEWAY_URL, playerToken);

      await Promise.all([
        new Promise<void>((resolve) => socketGM.on('connect', resolve)),
        new Promise<void>((resolve) => socketPlayer.on('connect', resolve)),
      ]);

      // ✅ 6. 핵심: 맵 참여 이벤트 발송 (ChatGateway의 joinRoom과 동일한 역할)
      socketGM.emit('joinMap', { mapId });
      socketPlayer.emit('joinMap', { mapId });

      await Promise.all([
        socketGM.waitForEvent('joinedMap'),
        socketPlayer.waitForEvent('joinedMap'),
      ]);
    });

    afterEach(() => {
      socketGM?.disconnect();
      socketPlayer?.disconnect();
    });

    it('S-VTT-GW-2: GM이 맵에 참여하고 토큰 이동 → 플레이어가 실시간으로 수신', async () => {
      // GM이 토큰 이동
      socketGM.emit('moveToken', { tokenId, x: 200, y: 200 });

      // 플레이어가 수신
      const moved = await socketPlayer.waitForEvent('tokenMoved');
      expect(moved).toMatchObject({
        tokenId,
        x: 200,
        y: 200,
      });

      // DB 확인
      const token = await tokenRepository.findOne({ where: { id: tokenId } });
      expect(token.x).toBe(200);
      expect(token.y).toBe(200);
    });

    it('F-VTT-GW-2: 권한 없는 플레이어가 일반 토큰 이동 시도 → error 발생', async () => {
      socketPlayer.emit('moveToken', { tokenId, x: 300, y: 300 });

      const error = await socketPlayer.waitForEvent('error');
      expect(error.message).toBe(
        TOKEN_ERROR_MESSAGES[TokenErrorCode.NO_MOVE_PERMISSION],
      );

      // DB 미변경 확인
      const token = await tokenRepository.findOne({ where: { id: tokenId } });
      console.log('Token from DB:', {
        id: token.id,
        characterSheetId: token.characterSheetId,
        type: typeof token.characterSheetId,
      });
      expect(token.x).toBe(100);
      expect(token.y).toBe(200);
    });

    it('S-VTT-GW-3: GM이 맵 설정 업데이트 → 플레이어가 실시간 수신', async () => {
      socketGM.emit('joinMap', { mapId });
      socketPlayer.emit('joinMap', { mapId });
      await socketGM.waitForEvent('joinedMap');
      await socketPlayer.waitForEvent('joinedMap');

      const updates = { gridSize: 60, showGrid: true };
      socketGM.emit('updateMap', { mapId, updates });

      const updated = await socketPlayer.waitForEvent('mapUpdated');
      expect(updated).toMatchObject({
        mapId,
        gridSize: 60,
        showGrid: true,
      });
    });

    it('F-VTT-GW-3: 플레이어가 맵 업데이트 시도 → error 발생', async () => {
      socketPlayer.emit('joinMap', { mapId });
      await socketPlayer.waitForEvent('joinedMap');

      socketPlayer.emit('updateMap', { mapId, updates: { gridSize: 70 } });

      const error = await socketPlayer.waitForEvent('error');
      // VttMapService에서 GM 권한 체크 → ForbiddenException 발생
      expect(error.message).toBe(VTTMAP_ERRORS.NOT_ROOM_CREATOR);

      // DB 미변경
      const map = await vttMapRepository.findOne({ where: { id: mapId } });
      expect(map.gridSize).toBe(50);
    });

    it('S-VTT-GW-4: 사용자가 leaveMap 후에는 이벤트 수신 안 함', async () => {
      socketGM.emit('joinMap', { mapId });
      socketPlayer.emit('joinMap', { mapId });
      await socketGM.waitForEvent('joinedMap');
      await socketPlayer.waitForEvent('joinedMap');

      // 플레이어 퇴장
      socketPlayer.emit('leaveMap', { mapId });
      await socketPlayer.waitForEvent('leftMap');

      // GM이 토큰 이동
      socketGM.emit('moveToken', { tokenId, x: 400, y: 400 });

      // 플레이어는 수신하지 않음
      await expect(
        socketPlayer.waitForEvent('tokenMoved', 2000),
      ).rejects.toThrow();
    });
  });
});
