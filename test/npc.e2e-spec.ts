// src/npc/e2e/npc.e2e-spec.ts
import { TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { TrpgSystem } from '@/common/enums/trpg-system.enum';
import { User } from '@/users/entities/user.entity';
import { Room } from '@/room/entities/room.entity';
import { NpcType } from '@/common/enums/npc-type.enum';
import { ParticipantRole } from '@/common/enums/participant-role.enum';
import { createUserDto } from '@/users/factory/user.factory';
import { RoomService } from '@/room/room.service';
import { Npc } from '@/npc/entities/npc.entity';
import {
  setupTestApp,
  signUpAndLogin,
  truncateAllTables,
} from './utils/test.util';
import { ImageMimeType } from '@/common/enums/image-mime-type.enum';

describe('NpcController (e2e)', () => {
  let app: INestApplication;
  let module: TestingModule;
  let dataSource: DataSource;

  let npcRepository: Repository<Npc>;
  let roomRepository: Repository<Room>;
  let userRepository: Repository<User>;
  let roomService: RoomService;

  let gmUser: User;
  let playerUser: User;
  let otherPlayerUser: User;
  let gmToken: string;
  let playerToken: string;
  // let otherPlayerToken: string;
  let testRoom: Room;

  const VALID_IMAGE_CASES = [
    { fileName: 'avatar.png', contentType: ImageMimeType.PNG },
    { fileName: 'character.jpg', contentType: ImageMimeType.JPEG },
    { fileName: 'monster.jpeg', contentType: ImageMimeType.JPEG },
    { fileName: 'map.webp', contentType: ImageMimeType.WEBP },
  ] as const;

  const validateNpcKeyFormat = (
    key: string,
    fileName: string,
    roomId: string,
  ) => {
    const ext = fileName.split('.').pop()!.toLowerCase();
    const normalizedExt = ext === 'jpeg' ? 'jpg' : ext;
    const keyPattern = new RegExp(
      `^uploads/npcs/${roomId}/[a-zA-Z0-9_-]+\\.${normalizedExt}$`,
    );
    expect(key).toMatch(keyPattern);
  };

  beforeAll(async () => {
    const testApp = await setupTestApp();
    ({ app, module, dataSource } = testApp);

    npcRepository = module.get<Repository<Npc>>(getRepositoryToken(Npc));
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
    const otherPlayerUserInfo = createUserDto();

    gmToken = await signUpAndLogin(app, gmUserInfo);
    playerToken = await signUpAndLogin(app, playerUserInfo);
    // otherPlayerToken = await signUpAndLogin(app, otherPlayerUserInfo);
    await signUpAndLogin(app, otherPlayerUserInfo);

    gmUser = await userRepository.findOneBy({ email: gmUserInfo.email });
    playerUser = await userRepository.findOneBy({
      email: playerUserInfo.email,
    });
    otherPlayerUser = await userRepository.findOneBy({
      email: otherPlayerUserInfo.email,
    });

    await roomService.createRoom(
      {
        system: TrpgSystem.DND5E,
        name: 'NPC Test Room',
        password: 'test1234',
        maxParticipants: 5,
      },
      gmUser.id,
    );

    testRoom = await roomRepository.findOne({
      where: { name: 'NPC Test Room' },
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
    await roomService.joinRoom(testRoom.id, otherPlayerUser.id, {
      password: 'test1234',
    });
  });

  // ========== 유즈 케이스 테스트 ==========

  describe('UC-01: NPC 생성', () => {
    it('성공: GM이 NPC를 생성할 수 있어야 한다', async () => {
      const createDto = {
        data: { name: 'Gandalf', level: 10 },
        isPublic: true,
        type: NpcType.NPC,
      };

      const response = await request(app.getHttpServer())
        .post(`/npcs/room/${testRoom.id}`)
        .set('Authorization', `Bearer ${gmToken}`)
        .send(createDto)
        .expect(201);

      expect(response.body.id).toBeDefined();
      expect(response.body.trpgType).toBe(TrpgSystem.DND5E);
      expect(response.body.type).toBe(NpcType.NPC);
      expect(response.body.isPublic).toBe(true);
      expect(response.body.roomId).toBe(testRoom.id);
    });

    it('성공: GM이 몬스터를 생성할 수 있어야 한다', async () => {
      const createDto = {
        data: { name: 'Dragon', hp: 200, ac: 18 },
        isPublic: false,
        type: NpcType.MONSTER,
      };

      const response = await request(app.getHttpServer())
        .post(`/npcs/room/${testRoom.id}`)
        .set('Authorization', `Bearer ${gmToken}`)
        .send(createDto)
        .expect(201);

      expect(response.body.type).toBe(NpcType.MONSTER);
      expect(response.body.isPublic).toBe(false);
    });
  });

  describe('UC-02: NPC 조회', () => {
    let publicNpc: Npc;
    let privateNpc: Npc;

    beforeEach(async () => {
      publicNpc = await npcRepository.save({
        data: { name: 'Public NPC' },
        trpgType: testRoom.system,
        isPublic: true,
        type: NpcType.NPC,
        room: testRoom,
      });

      privateNpc = await npcRepository.save({
        data: { name: 'Secret Monster' },
        trpgType: testRoom.system,
        isPublic: false,
        type: NpcType.MONSTER,
        room: testRoom,
      });
    });

    it('성공: GM은 모든 NPC/몬스터를 조회할 수 있어야 한다', async () => {
      const response = await request(app.getHttpServer())
        .get(`/npcs/${privateNpc.id}`)
        .set('Authorization', `Bearer ${gmToken}`)
        .expect(200);

      expect(response.body.id).toBe(privateNpc.id);
      expect(response.body.type).toBe(NpcType.MONSTER);
    });

    it('성공: PLAYER는 공개된 NPC만 조회할 수 있어야 한다', async () => {
      const response = await request(app.getHttpServer())
        .get(`/npcs/${publicNpc.id}`)
        .set('Authorization', `Bearer ${playerToken}`)
        .expect(200);

      expect(response.body.id).toBe(publicNpc.id);
    });

    it('실패: PLAYER는 비공개 NPC를 조회할 수 없어야 한다 (403)', async () => {
      await request(app.getHttpServer())
        .get(`/npcs/${privateNpc.id}`)
        .set('Authorization', `Bearer ${playerToken}`)
        .expect(403);
    });
  });

  describe('UC-03: NPC 목록 조회', () => {
    beforeEach(async () => {
      await npcRepository.save([
        {
          data: {},
          trpgType: testRoom.system,
          isPublic: true,
          type: NpcType.NPC,
          room: testRoom,
        },
        {
          data: {},
          trpgType: testRoom.system,
          isPublic: false,
          type: NpcType.NPC,
          room: testRoom,
        },
        {
          data: {},
          trpgType: testRoom.system,
          isPublic: true,
          type: NpcType.MONSTER,
          room: testRoom,
        },
        {
          data: {},
          trpgType: testRoom.system,
          isPublic: false,
          type: NpcType.MONSTER,
          room: testRoom,
        },
      ]);
    });

    it('성공: GM은 모든 NPC/몬스터 목록을 조회할 수 있어야 한다', async () => {
      const response = await request(app.getHttpServer())
        .get(`/npcs`)
        .query({ roomId: testRoom.id })
        .set('Authorization', `Bearer ${gmToken}`)
        .expect(200);

      expect(response.body).toHaveLength(4);
    });

    it('성공: PLAYER는 공개된 NPC/몬스터만 조회할 수 있어야 한다', async () => {
      const response = await request(app.getHttpServer())
        .get(`/npcs`)
        .query({ roomId: testRoom.id })
        .set('Authorization', `Bearer ${playerToken}`)
        .expect(200);

      expect(response.body).toHaveLength(2); // isPublic: true인 2개
      response.body.forEach((npc) => expect(npc.isPublic).toBe(true));
    });

    it('성공: type 파라미터로 NPC만 필터링 가능', async () => {
      const response = await request(app.getHttpServer())
        .get(`/npcs`)
        .query({ roomId: testRoom.id, type: NpcType.NPC })
        .set('Authorization', `Bearer ${playerToken}`)
        .expect(200);

      expect(response.body).toHaveLength(1); // 공개된 NPC 1개
      expect(response.body[0].type).toBe(NpcType.NPC);
    });

    it('성공: type 파라미터로 몬스터만 필터링 가능', async () => {
      const response = await request(app.getHttpServer())
        .get(`/npcs`)
        .query({ roomId: testRoom.id, type: NpcType.MONSTER })
        .set('Authorization', `Bearer ${gmToken}`) // GM은 비공개도 볼 수 있음
        .expect(200);

      expect(response.body).toHaveLength(2); // 몬스터 2개 (공개+비공개)
      response.body.forEach((npc) => expect(npc.type).toBe(NpcType.MONSTER));
    });
  });

  describe('UC-04: NPC 업데이트', () => {
    let npc: Npc;

    beforeEach(async () => {
      npc = await npcRepository.save({
        data: { name: 'Old NPC' },
        trpgType: testRoom.system,
        isPublic: false,
        type: NpcType.NPC,
        room: testRoom,
      });
    });

    it('성공: GM은 NPC를 업데이트할 수 있어야 한다', async () => {
      const updateDto = {
        data: { name: 'Updated NPC', level: 5 },
        isPublic: true,
        type: NpcType.MONSTER,
      };

      const response = await request(app.getHttpServer())
        .patch(`/npcs/${npc.id}`)
        .set('Authorization', `Bearer ${gmToken}`)
        .send(updateDto)
        .expect(200);

      expect(response.body.data.name).toBe('Updated NPC');
      expect(response.body.isPublic).toBe(true);
      expect(response.body.type).toBe(NpcType.MONSTER);
    });
  });

  describe('UC-05: NPC 삭제', () => {
    let npc: Npc;

    beforeEach(async () => {
      npc = await npcRepository.save({
        data: { name: 'To be deleted' },
        trpgType: testRoom.system,
        isPublic: true,
        room: testRoom,
      });
    });

    it('성공: GM은 NPC를 삭제할 수 있어야 한다', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/npcs/${npc.id}`)
        .set('Authorization', `Bearer ${gmToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      const deleted = await npcRepository.findOneBy({ id: npc.id });
      expect(deleted).toBeNull();
    });
  });

  describe('UC-06: NPC 이미지 업로드 Presigned URL 발급 - 성공 케이스', () => {
    VALID_IMAGE_CASES.forEach(({ fileName, contentType }) => {
      it(`성공: GM이 roomId 기반으로 유효한 이미지(${fileName}, ${contentType})에 대한 Presigned URL을 발급받음`, async () => {
        const res = await request(app.getHttpServer())
          .post(`/npcs/room/${testRoom.id}/presigned-url`)
          .set('Authorization', `Bearer ${gmToken}`)
          .send({ fileName, contentType })
          .expect(201);

        const { key, presignedUrl, publicUrl } = res.body;

        validateNpcKeyFormat(key, fileName, testRoom.id);

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
    it('실패: PLAYER가 NPC를 생성하려 할 경우 403', async () => {
      await request(app.getHttpServer())
        .post(`/npcs/room/${testRoom.id}`)
        .set('Authorization', `Bearer ${playerToken}`)
        .send({ data: {}, isPublic: true, type: NpcType.NPC })
        .expect(403);
    });

    it('실패: PLAYER가 NPC를 수정하려 할 경우 403', async () => {
      const npc = await npcRepository.save({
        data: {},
        trpgType: testRoom.system,
        isPublic: true,
        room: testRoom,
        roomId: testRoom.id,
      });

      await request(app.getHttpServer())
        .patch(`/npcs/${npc.id}`)
        .set('Authorization', `Bearer ${playerToken}`)
        .send({ data: { hacked: true }, type: NpcType.NPC })
        .expect(403);
    });

    it('실패: PLAYER가 NPC를 삭제하려 할 경우 403', async () => {
      const npc = await npcRepository.save({
        data: {},
        trpgType: testRoom.system,
        isPublic: true,
        room: testRoom,
        roomId: testRoom.id,
      });

      await request(app.getHttpServer())
        .delete(`/npcs/${npc.id}`)
        .set('Authorization', `Bearer ${playerToken}`)
        .expect(403);
    });
  });

  describe('EC-02: 존재하지 않는 리소스', () => {
    it('실패: 존재하지 않는 NPC 조회 시 404', async () => {
      await request(app.getHttpServer())
        .get('/npcs/999999')
        .set('Authorization', `Bearer ${gmToken}`)
        .expect(404);
    });

    it('실패: 존재하지 않는 NPC 수정 시 404', async () => {
      await request(app.getHttpServer())
        .patch('/npcs/999999')
        .set('Authorization', `Bearer ${gmToken}`)
        .send({ data: {}, type: NpcType.NPC })
        .expect(404);
    });

    it('실패: 존재하지 않는 방에 NPC 생성 시 404 (또는 403)', async () => {
      const nonExistentRoomId = '123e4567-e89b-12d3-a456-426614174000';
      await request(app.getHttpServer())
        .post(`/npcs/room/${nonExistentRoomId}`)
        .set('Authorization', `Bearer ${gmToken}`)
        .send({ data: {}, isPublic: true, type: NpcType.NPC })
        .expect(403);
    });
  });

  describe('EC-03: 유효하지 않은 type 값', () => {
    it('실패: 유효하지 않은 type으로 생성 시 400', async () => {
      await request(app.getHttpServer())
        .post(`/npcs/room/${testRoom.id}`)
        .set('Authorization', `Bearer ${gmToken}`)
        .send({ data: {}, isPublic: true, type: 'invalid-type' })
        .expect(400);
    });
  });

  describe('EC-06: NPC 이미지 업로드 Presigned URL 발급 - 실패 케이스', () => {
    it('실패: PLAYER가 요청 시 403 반환 (GM만 허용)', async () => {
      const { fileName, contentType } = VALID_IMAGE_CASES[0];
      await request(app.getHttpServer())
        .post(`/npcs/room/${testRoom.id}/presigned-url`)
        .set('Authorization', `Bearer ${playerToken}`)
        .send({ fileName, contentType })
        .expect(403);
    });

    it('실패: 존재하지 않는 roomId → 403 (방 접근 권한 없음)', async () => {
      const nonExistentRoomId = '123e4567-e89b-12d3-a456-426614174000';
      const { fileName, contentType } = VALID_IMAGE_CASES[0];
      await request(app.getHttpServer())
        .post(`/npcs/room/${nonExistentRoomId}/presigned-url`)
        .set('Authorization', `Bearer ${gmToken}`)
        .send({ fileName, contentType })
        .expect(403);
    });

    it('실패: 지원하지 않는 MIME 타입 → 400', async () => {
      await request(app.getHttpServer())
        .post(`/npcs/room/${testRoom.id}/presigned-url`)
        .set('Authorization', `Bearer ${gmToken}`)
        .send({ fileName: 'document.pdf', contentType: 'application/pdf' })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain('지원하지 않는 파일 형식입니다.');
        });
    });

    it('실패: 확장자와 MIME 타입 불일치 → 400', async () => {
      await request(app.getHttpServer())
        .post(`/npcs/room/${testRoom.id}/presigned-url`)
        .set('Authorization', `Bearer ${gmToken}`)
        .send({ fileName: 'image.png', contentType: ImageMimeType.JPEG })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain(
            '파일 확장자와 MIME 타입이 일치하지 않습니다.',
          );
        });
    });

    it('실패: 파일 이름에 확장자가 없음 → 400', async () => {
      await request(app.getHttpServer())
        .post(`/npcs/room/${testRoom.id}/presigned-url`)
        .set('Authorization', `Bearer ${gmToken}`)
        .send({ fileName: 'no_extension', contentType: ImageMimeType.PNG })
        .expect(400);
    });

    it('실패: 빈 파일 이름 → 400', async () => {
      await request(app.getHttpServer())
        .post(`/npcs/room/${testRoom.id}/presigned-url`)
        .set('Authorization', `Bearer ${gmToken}`)
        .send({ fileName: '', contentType: ImageMimeType.PNG })
        .expect(400);
    });

    it('실패: roomId가 UUID 형식이 아님 → 400 (ParseUUIDPipe 실패)', async () => {
      await request(app.getHttpServer())
        .post(`/npcs/room/invalid-room-id/presigned-url`)
        .set('Authorization', `Bearer ${gmToken}`)
        .send(VALID_IMAGE_CASES[0])
        .expect(400);
    });
  });
});
