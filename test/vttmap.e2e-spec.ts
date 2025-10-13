// src/vttmaps/e2e/vttmap.e2e-spec.ts
import { TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { TrpgSystem } from '@/common/enums/trpg-system.enum';
import { User } from '@/users/entities/user.entity';
import { Room } from '@/room/entities/room.entity';
import { ParticipantRole } from '@/common/enums/participant-role.enum';
import { createUserDto } from '@/users/factory/user.factory';
import { RoomService } from '@/room/room.service';
import { ImageMimeType } from '@/common/enums/image-mime-type.enum';
import { GridType } from '@/common/enums/grid-type.enum';
import {
  setupTestApp,
  signUpAndLogin,
  truncateAllTables,
} from './utils/test.util';
import { VttMap } from '@/vttmap/entities/vttmap.entity';

describe('VttMapController (e2e)', () => {
  let app: INestApplication;
  let module: TestingModule;
  let dataSource: DataSource;

  let vttMapRepository: Repository<VttMap>;
  let roomRepository: Repository<Room>;
  let userRepository: Repository<User>;
  let roomService: RoomService;

  let gmUser: User;
  let playerUser: User;
  let gmToken: string;
  let playerToken: string;
  let testRoom: Room;

  const VALID_IMAGE_CASES = [
    { fileName: 'map.png', contentType: ImageMimeType.PNG },
    { fileName: 'background.jpg', contentType: ImageMimeType.JPEG },
    { fileName: 'dungeon.jpeg', contentType: ImageMimeType.JPEG },
    { fileName: 'battlemap.webp', contentType: ImageMimeType.WEBP },
  ] as const;

  const validateVttMapKeyFormat = (
    key: string,
    fileName: string,
    roomId: string,
  ) => {
    const ext = fileName.split('.').pop()!.toLowerCase();
    const normalizedExt = ext === 'jpeg' ? 'jpg' : ext;
    const keyPattern = new RegExp(
      `^uploads/vttmaps/${roomId}/[a-zA-Z0-9_-]+\\.${normalizedExt}$`,
    );
    expect(key).toMatch(keyPattern);
  };

  beforeAll(async () => {
    const testApp = await setupTestApp();
    ({ app, module, dataSource } = testApp);

    vttMapRepository = module.get<Repository<VttMap>>(
      getRepositoryToken(VttMap),
    );
    roomRepository = module.get<Repository<Room>>(getRepositoryToken(Room));
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    roomService = module.get<RoomService>(RoomService);
  });

  afterAll(async () => {
    await truncateAllTables(dataSource);
    await app.close();
  });

  beforeEach(async () => {
    await truncateAllTables(dataSource);

    const gmUserInfo = createUserDto();
    const playerUserInfo = createUserDto();

    gmToken = await signUpAndLogin(app, gmUserInfo);
    playerToken = await signUpAndLogin(app, playerUserInfo);

    gmUser = await userRepository.findOneBy({ email: gmUserInfo.email });
    playerUser = await userRepository.findOneBy({
      email: playerUserInfo.email,
    });

    await roomService.createRoom(
      {
        system: TrpgSystem.DND5E,
        name: 'VttMap Test Room',
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
  });

  // ========== 유즈 케이스 테스트 ==========

  describe('UC-01: VTT 맵 생성', () => {
    it('성공: GM이 VTT 맵을 생성할 수 있어야 한다', async () => {
      const createDto = {
        name: '던전 입구',
        imageUrl: 'https://example.com/map.jpg',
        gridType: GridType.SQUARE,
        gridSize: 50,
        showGrid: true,
      };

      const response = await request(app.getHttpServer())
        .post(`/rooms/${testRoom.id}/vttmaps`)
        .set('Authorization', `Bearer ${gmToken}`)
        .send(createDto)
        .expect(201);

      expect(response.body.vttMap.id).toBeDefined();
      expect(response.body.vttMap.name).toBe('던전 입구');
      expect(response.body.vttMap.gridType).toBe(GridType.SQUARE);
      expect(response.body.vttMap.roomId).toBe(testRoom.id);
    });

    it('실패: PLAYER가 VTT 맵을 생성하려 할 경우 403', async () => {
      const createDto = { name: 'Hacked Map' };

      await request(app.getHttpServer())
        .post(`/rooms/${testRoom.id}/vttmaps`)
        .set('Authorization', `Bearer ${playerToken}`)
        .send(createDto)
        .expect(403);
    });

    it('실패: 이미 VTT 맵이 존재하는 방에 다시 생성 시도 → 403', async () => {
      const createDto = { name: 'First Map' };
      await request(app.getHttpServer())
        .post(`/rooms/${testRoom.id}/vttmaps`)
        .set('Authorization', `Bearer ${gmToken}`)
        .send(createDto)
        .expect(201);

      await request(app.getHttpServer())
        .post(`/rooms/${testRoom.id}/vttmaps`)
        .set('Authorization', `Bearer ${gmToken}`)
        .send({ name: 'Second Map' })
        .expect(403);
    });
  });

  describe('UC-02: VTT 맵 조회', () => {
    beforeEach(async () => {
      await vttMapRepository.save({
        name: 'Test Map',
        gridType: GridType.SQUARE,
        gridSize: 60,
        showGrid: true,
        room: testRoom,
      });
    });

    it('성공: GM이 VTT 맵을 조회할 수 있어야 한다', async () => {
      const response = await request(app.getHttpServer())
        .get(`/rooms/${testRoom.id}/vttmaps`)
        .set('Authorization', `Bearer ${gmToken}`)
        .expect(200);

      expect(response.body.vttMap.name).toBe('Test Map');
    });

    it('성공: PLAYER도 VTT 맵을 조회할 수 있어야 한다', async () => {
      const response = await request(app.getHttpServer())
        .get(`/rooms/${testRoom.id}/vttmaps`)
        .set('Authorization', `Bearer ${playerToken}`)
        .expect(200);

      expect(response.body.vttMap.name).toBe('Test Map');
    });

    it('실패: 존재하지 않는 방의 VTT 맵 조회 → 404', async () => {
      const nonExistentRoomId = '123e4567-e89b-12d3-a456-426614174000';
      await request(app.getHttpServer())
        .get(`/rooms/${nonExistentRoomId}/vttmaps`)
        .set('Authorization', `Bearer ${gmToken}`)
        .expect(404);
    });
  });

  describe('UC-03: VTT 맵 업데이트', () => {
    beforeEach(async () => {
      await vttMapRepository.save({
        name: 'Old Map',
        gridType: GridType.SQUARE,
        gridSize: 50,
        showGrid: true,
        room: testRoom,
      });
    });

    it('성공: GM이 VTT 맵을 업데이트할 수 있어야 한다', async () => {
      const updateDto = {
        name: 'Updated Map',
        gridType: GridType.NONE,
        gridSize: 100,
        showGrid: false,
      };

      const response = await request(app.getHttpServer())
        .patch(`/rooms/${testRoom.id}/vttmaps`)
        .set('Authorization', `Bearer ${gmToken}`)
        .send(updateDto)
        .expect(200);

      expect(response.body.vttMap.name).toBe('Updated Map');
      expect(response.body.vttMap.gridType).toBe(GridType.NONE);
      expect(response.body.vttMap.showGrid).toBe(false);
    });

    it('실패: PLAYER가 VTT 맵을 수정하려 할 경우 403', async () => {
      await request(app.getHttpServer())
        .patch(`/rooms/${testRoom.id}/vttmaps`)
        .set('Authorization', `Bearer ${playerToken}`)
        .send({ name: 'Hacked' })
        .expect(403);
    });
  });

  describe('UC-04: VTT 맵 이미지 업로드 Presigned URL 발급 - 성공', () => {
    VALID_IMAGE_CASES.forEach(({ fileName, contentType }) => {
      it(`성공: GM이 roomId 기반으로 유효한 이미지(${fileName}, ${contentType})에 대한 Presigned URL을 발급받음`, async () => {
        const res = await request(app.getHttpServer())
          .post(`/rooms/${testRoom.id}/vttmaps/presigned-url`)
          .set('Authorization', `Bearer ${gmToken}`)
          .send({ fileName, contentType })
          .expect(201);

        const { key, presignedUrl, publicUrl } = res.body;

        validateVttMapKeyFormat(key, fileName, testRoom.id);

        expect(presignedUrl).toContain(key);
        expect(presignedUrl).toMatch(
          /^https:\/\/mock-presigned\.s3\.amazonaws\.com\/.*\?X-Amz-Signature=mock$/,
        );
        expect(publicUrl.trim()).toBe(`https://d12345.cloudfront.net/${key}`);
      });
    });
  });

  // ========== 엣지 케이스 테스트 ==========

  describe('EC-01: 권한 없는 요청', () => {
    it('실패: PLAYER가 Presigned URL 요청 시 403', async () => {
      const { fileName, contentType } = VALID_IMAGE_CASES[0];
      await request(app.getHttpServer())
        .post(`/rooms/${testRoom.id}/vttmaps/presigned-url`)
        .set('Authorization', `Bearer ${playerToken}`)
        .send({ fileName, contentType })
        .expect(403);
    });
  });

  describe('EC-02: 유효성 검사 실패', () => {
    it('실패: 지원하지 않는 MIME 타입 → 400', async () => {
      await request(app.getHttpServer())
        .post(`/rooms/${testRoom.id}/vttmaps/presigned-url`)
        .set('Authorization', `Bearer ${gmToken}`)
        .send({ fileName: 'map.pdf', contentType: 'application/pdf' })
        .expect(400);
    });

    it('실패: 확장자와 MIME 불일치 → 400', async () => {
      await request(app.getHttpServer())
        .post(`/rooms/${testRoom.id}/vttmaps/presigned-url`)
        .set('Authorization', `Bearer ${gmToken}`)
        .send({ fileName: 'map.png', contentType: ImageMimeType.JPEG })
        .expect(400);
    });

    it('실패: gridType이 유효하지 않은 값 → 400', async () => {
      await request(app.getHttpServer())
        .post(`/rooms/${testRoom.id}/vttmaps`)
        .set('Authorization', `Bearer ${gmToken}`)
        .send({ name: 'Bad Map', gridType: 'hex' })
        .expect(400);
    });
  });

  describe('EC-03: 존재하지 않는 리소스', () => {
    it('실패: 존재하지 않는 방에 VTT 맵 생성 시도 → 403', async () => {
      const nonExistentRoomId = '123e4567-e89b-12d3-a456-426614174000';
      await request(app.getHttpServer())
        .post(`/rooms/${nonExistentRoomId}/vttmaps`)
        .set('Authorization', `Bearer ${gmToken}`)
        .send({ name: 'Fake Map' })
        .expect(403);
    });
  });
});
