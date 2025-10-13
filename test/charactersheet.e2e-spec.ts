import { TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { TrpgSystem } from '@/common/enums/trpg-system.enum';
import { CharacterSheet } from '@/character-sheet/entities/character-sheet.entity';
import { User } from '@/users/entities/user.entity';
import { createUserDto } from '@/users/factory/user.factory';
import {
  setupTestApp,
  signUpAndLogin,
  truncateAllTables,
} from './utils/test.util';
import { RoomParticipant } from '@/room/entities/room-participant.entity';
import { Room } from '@/room/entities/room.entity';
import {
  createCharacterSheet,
  createCharacterSheetDto,
  updateCharacterSheetDto,
} from '@/character-sheet/factory/character-sheet.factory';
import { RoomService } from '@/room/room.service';
import { ParticipantRole } from '@/common/enums/participant-role.enum';
import { ImageMimeType } from '@/common/enums/image-mime-type.enum';

describe('CharacterSheetController (e2e)', () => {
  let app: INestApplication;
  let module: TestingModule;
  let dataSource: DataSource;

  let characterSheetRepository: Repository<CharacterSheet>;
  let roomRepository: Repository<Room>;
  let userRepository: Repository<User>;
  let roomService: RoomService;

  let playerUser: User;
  let gmUser: User;
  let otherPlayerUser: User;
  let playerToken: string;
  let gmToken: string;
  let otherPlayerToken: string;

  let testRoom: Room;
  let playerParticipant: RoomParticipant;
  let gmParticipant: RoomParticipant;
  let otherPlayerParticipant: RoomParticipant;

  const VALID_IMAGE_CASES = [
    { fileName: 'avatar.png', contentType: ImageMimeType.PNG },
    { fileName: 'character.jpg', contentType: ImageMimeType.JPEG },
    { fileName: 'monster.jpeg', contentType: ImageMimeType.JPEG },
    { fileName: 'map.webp', contentType: ImageMimeType.WEBP },
  ] as const;

  const validateKeyFormat = (
    key: string,
    fileName: string,
    roomId: string,
    participantId: number,
  ) => {
    const ext = fileName.split('.').pop()!.toLowerCase();
    const normalizedExt = ext === 'jpeg' ? 'jpg' : ext;
    const keyPattern = new RegExp(
      `^uploads/characters/${roomId}/${participantId}/[a-zA-Z0-9_-]+\\.${normalizedExt}$`,
    );
    expect(key).toMatch(keyPattern);
  };

  beforeAll(async () => {
    const testApp = await setupTestApp();
    ({ app, module, dataSource } = testApp);

    characterSheetRepository = module.get<Repository<CharacterSheet>>(
      getRepositoryToken(CharacterSheet),
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

    const playerUserInfo = createUserDto();
    const gmUserInfo = createUserDto();
    const otherPlayerUserInfo = createUserDto();

    playerToken = await signUpAndLogin(app, playerUserInfo);
    gmToken = await signUpAndLogin(app, gmUserInfo);
    otherPlayerToken = await signUpAndLogin(app, otherPlayerUserInfo);

    playerUser = await userRepository.findOneBy({
      email: playerUserInfo.email,
    });
    gmUser = await userRepository.findOneBy({ email: gmUserInfo.email });
    otherPlayerUser = await userRepository.findOneBy({
      email: otherPlayerUserInfo.email,
    });

    const createRoomDto = {
      system: TrpgSystem.DND5E,
      name: 'Test Room',
      password: 'test1234',
      maxParticipants: 5,
    };
    await roomService.createRoom(createRoomDto, gmUser.id);

    testRoom = await roomRepository.findOne({
      where: { name: 'Test Room' },
      relations: ['creator', 'participants', 'participants.user'],
    });

    await roomService.updateParticipantRole(
      testRoom.id,
      gmUser.id, // currentUserId (권한 있는 사용자: 방장 자신)
      gmUser.id, // targetUserId (변경 대상: 방장)
      ParticipantRole.GM,
    );

    await roomService.joinRoom(testRoom.id, playerUser.id, {
      password: 'test1234',
    });
    await roomService.joinRoom(testRoom.id, otherPlayerUser.id, {
      password: 'test1234',
    });

    testRoom = await roomRepository.findOne({
      where: { id: testRoom.id },
      relations: ['creator', 'participants', 'participants.user'],
    });

    playerParticipant = testRoom.participants.find(
      (p) => p.user.id === playerUser.id,
    );
    gmParticipant = testRoom.participants.find((p) => p.user.id === gmUser.id);
    otherPlayerParticipant = testRoom.participants.find(
      (p) => p.user.id === otherPlayerUser.id,
    );
  });
  // ========== 유즈 케이스 테스트 ==========

  describe('UC-01: 캐릭터 시트 생성', () => {
    it('성공: 플레이어가 자신의 시트를 성공적으로 생성해야 한다', async () => {
      const createDto = createCharacterSheetDto({
        data: { name: 'Legolas', level: 5, hp: 45 },
        isPublic: false,
      });

      const response = await request(app.getHttpServer())
        .post(`/character-sheets/${playerParticipant.id}`)
        .set('Authorization', `Bearer ${playerToken}`)
        .send(createDto)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.trpgType).toBe(testRoom.system);
      expect(response.body.data).toEqual(createDto.data);
      expect(response.body.isPublic).toBe(false);
      expect(response.body.participantId).toBe(playerParticipant.id);
    });

    it('성공: GM이 자신의 시트를 생성하고 isPublic을 true로 설정할 수 있어야 한다', async () => {
      const createDto = createCharacterSheetDto({
        data: { name: 'Sherlock Holmes', sanity: 70 },
        isPublic: true,
      });

      const response = await request(app.getHttpServer())
        .post(`/character-sheets/${gmParticipant.id}`)
        .set('Authorization', `Bearer ${gmToken}`)
        .send(createDto)
        .expect(201);

      expect(response.body.trpgType).toBe(testRoom.system);
      expect(response.body.isPublic).toBe(true);
    });

    it('성공: GM도 isPublic을 false로 설정할 수 있어야 한다', async () => {
      const createDto = createCharacterSheetDto({
        data: { name: 'Secret NPC' },
        isPublic: false,
      });

      const response = await request(app.getHttpServer())
        .post(`/character-sheets/${gmParticipant.id}`)
        .set('Authorization', `Bearer ${gmToken}`)
        .send(createDto)
        .expect(201);

      expect(response.body.trpgType).toBe(testRoom.system);
      expect(response.body.isPublic).toBe(false);
    });
  });

  describe('UC-02: 캐릭터 시트 조회', () => {
    let createdSheet: CharacterSheet;

    beforeEach(async () => {
      createdSheet = await characterSheetRepository.save(
        createCharacterSheet({
          participant: playerParticipant,
          trpgType: TrpgSystem.DND5E,
          data: { name: 'Legolas', level: 5 },
          isPublic: false,
        }),
      );
    });

    it('성공: 소유자는 자신의 비공개 시트를 조회할 수 있어야 한다', async () => {
      const response = await request(app.getHttpServer())
        .get(`/character-sheets/${playerParticipant.id}`)
        .set('Authorization', `Bearer ${playerToken}`)
        .expect(200);

      expect(response.body.id).toBe(createdSheet.id);
      expect(response.body.data.name).toBe('Legolas');
    });

    it('성공: GM은 방 내 모든 시트(비공개 포함)를 조회할 수 있어야 한다', async () => {
      const response = await request(app.getHttpServer())
        .get(`/character-sheets/${playerParticipant.id}`)
        .set('Authorization', `Bearer ${gmToken}`)
        .expect(200);

      expect(response.body.id).toBe(createdSheet.id);
    });

    it('성공: isPublic이 true인 시트는 다른 플레이어도 조회할 수 있어야 한다', async () => {
      createdSheet.isPublic = true;
      await characterSheetRepository.save(createdSheet);

      const response = await request(app.getHttpServer())
        .get(`/character-sheets/${playerParticipant.id}`)
        .set('Authorization', `Bearer ${otherPlayerToken}`)
        .expect(200);

      expect(response.body.id).toBe(createdSheet.id);
    });
  });

  describe('UC-03: 캐릭터 시트 업데이트', () => {
    let createdSheet: CharacterSheet;

    beforeEach(async () => {
      createdSheet = await characterSheetRepository.save(
        createCharacterSheet({
          participant: playerParticipant,
          trpgType: TrpgSystem.DND5E,
          data: { name: 'Legolas', level: 5, hp: 45 },
          isPublic: false,
        }),
      );
    });

    it('성공: 소유자는 자신의 시트 데이터를 업데이트할 수 있어야 한다', async () => {
      const updateDto = updateCharacterSheetDto({
        data: { name: 'Legolas', level: 6, hp: 50, newField: 'Updated!' },
      });

      const response = await request(app.getHttpServer())
        .patch(`/character-sheets/${playerParticipant.id}`)
        .set('Authorization', `Bearer ${playerToken}`)
        .send(updateDto)
        .expect(200);

      expect(response.body.data).toEqual(updateDto.data);
      expect(new Date(response.body.updatedAt)).not.toEqual(
        createdSheet.updatedAt,
      );
    });

    it('성공: GM은 다른 플레이어의 시트 데이터를 업데이트할 수 있어야 한다', async () => {
      const updateDto = updateCharacterSheetDto({
        data: { ...createdSheet.data, level: 10 },
      });

      const response = await request(app.getHttpServer())
        .patch(`/character-sheets/${playerParticipant.id}`)
        .set('Authorization', `Bearer ${gmToken}`)
        .send(updateDto)
        .expect(200);

      expect(response.body.data.level).toBe(10);
    });

    it('성공: GM은 isPublic 필드를 true로 업데이트할 수 있어야 한다', async () => {
      const updateDto = updateCharacterSheetDto({
        isPublic: true,
      });

      const response = await request(app.getHttpServer())
        .patch(`/character-sheets/${playerParticipant.id}`)
        .set('Authorization', `Bearer ${gmToken}`)
        .send(updateDto)
        .expect(200);

      expect(response.body.isPublic).toBe(true);
    });

    it('성공: GM은 isPublic 필드를 false로도 업데이트할 수 있어야 한다', async () => {
      // 1. 기존 시트가 있다면 삭제 (혹은 직접 생성)
      await characterSheetRepository.delete({
        participant: { id: playerParticipant.id },
      });

      const initialData = { name: 'Legolas' };
      await characterSheetRepository.save(
        createCharacterSheet({
          participant: playerParticipant,
          trpgType: TrpgSystem.DND5E,
          data: initialData,
          isPublic: true,
        }),
      );

      const updateDto = updateCharacterSheetDto({
        data: initialData,
        isPublic: false,
      });

      const response = await request(app.getHttpServer())
        .patch(`/character-sheets/${playerParticipant.id}`)
        .set('Authorization', `Bearer ${gmToken}`)
        .send(updateDto)
        .expect(200);

      expect(response.body.isPublic).toBe(false);
    });
  });

  describe('UC-04: 캐릭터 시트 이미지 업로드 Presigned URL 발급 - 성공 케이스', () => {
    it('성공: 소유자가 자신의 시트에 대한 Presigned URL을 발급받음', async () => {
      const { fileName, contentType } = VALID_IMAGE_CASES[0];

      const res = await request(app.getHttpServer())
        .post(`/character-sheets/${playerParticipant.id}/presigned-url`)
        .set('Authorization', `Bearer ${playerToken}`)
        .send({ fileName, contentType })
        .expect(201);

      const { key, presignedUrl, publicUrl } = res.body;

      validateKeyFormat(key, fileName, testRoom.id, playerParticipant.id);

      expect(presignedUrl).toContain(key);
      expect(presignedUrl).toMatch(
        /^https:\/\/mock-presigned\.s3\.amazonaws\.com\/.*\?X-Amz-Signature=mock$/,
      );
      expect(publicUrl.trim()).toBe(`https://d12345.cloudfront.net/${key}`);
    });

    it('성공: GM이 다른 플레이어의 시트에 대한 Presigned URL을 발급받음', async () => {
      const { fileName, contentType } = VALID_IMAGE_CASES[1];

      const res = await request(app.getHttpServer())
        .post(`/character-sheets/${playerParticipant.id}/presigned-url`)
        .set('Authorization', `Bearer ${gmToken}`)
        .send({ fileName, contentType })
        .expect(201);

      validateKeyFormat(
        res.body.key,
        fileName,
        testRoom.id,
        playerParticipant.id,
      );
    });

    VALID_IMAGE_CASES.forEach(({ fileName, contentType }) => {
      it(`성공: 유효한 이미지 조합 - ${fileName} (${contentType})`, async () => {
        const res = await request(app.getHttpServer())
          .post(`/character-sheets/${playerParticipant.id}/presigned-url`)
          .set('Authorization', `Bearer ${playerToken}`)
          .send({ fileName, contentType })
          .expect(201);

        validateKeyFormat(
          res.body.key,
          fileName,
          testRoom.id,
          playerParticipant.id,
        );
      });
    });
  });

  // ========== 엣지 케이스 테스트 ==========

  describe('EC-01: 잘못된 participantId 입력', () => {
    it('실패: participantId가 숫자가 아닐 경우 400 에러를 반환해야 한다', async () => {
      await request(app.getHttpServer())
        .post(`/character-sheets/invalid_id`)
        .set('Authorization', `Bearer ${playerToken}`)
        .send(createCharacterSheetDto())
        .expect(400);
    });
  });

  describe('EC-02: 이미 존재하는 시트에 대한 생성 시도', () => {
    beforeEach(async () => {
      await characterSheetRepository.save(
        createCharacterSheet({
          participant: playerParticipant,
          trpgType: TrpgSystem.DND5E,
          data: {},
          isPublic: false,
        }),
      );
    });

    it('실패: 이미 존재하는 시트에 대해 생성 요청 시 409 에러를 반환해야 한다', async () => {
      const createDto = createCharacterSheetDto({
        data: { name: 'New Attempt' },
        isPublic: false,
      });

      await request(app.getHttpServer())
        .post(`/character-sheets/${playerParticipant.id}`)
        .set('Authorization', `Bearer ${playerToken}`)
        .send(createDto)
        .expect(409);
    });
  });

  describe('EC-03: 권한 없는 시트 조회/수정 시도', () => {
    let privateSheet: CharacterSheet;

    beforeEach(async () => {
      privateSheet = await characterSheetRepository.save(
        createCharacterSheet({
          participant: playerParticipant,
          trpgType: TrpgSystem.DND5E,
          data: { name: 'Private Character' },
          isPublic: false,
        }),
      );
    });

    it('실패: 다른 플레이어가 비공개 시트를 조회하려 할 경우 403 에러를 반환해야 한다', async () => {
      await request(app.getHttpServer())
        .get(`/character-sheets/${privateSheet.participant.id}`)
        .set('Authorization', `Bearer ${otherPlayerToken}`)
        .expect(403);
    });

    it('실패: 다른 플레이어가 비공개 시트를 수정하려 할 경우 403 에러를 반환해야 한다', async () => {
      await request(app.getHttpServer())
        .patch(`/character-sheets/${privateSheet.participant.id}`)
        .set('Authorization', `Bearer ${otherPlayerToken}`)
        .send(updateCharacterSheetDto({ data: { name: 'Hacked!' } }))
        .expect(403);
    });

    it('실패: 일반 플레이어가 isPublic 필드를 업데이트하려 할 경우 403 에러를 반환해야 한다', async () => {
      const updateDto = updateCharacterSheetDto({
        isPublic: true,
      });

      await request(app.getHttpServer())
        .patch(`/character-sheets/${playerParticipant.id}`)
        .set('Authorization', `Bearer ${playerToken}`)
        .send(updateDto)
        .expect(403);
    });
  });

  describe('UC-04: 캐릭터 시트 이미지 업로드 Presigned URL 발급 - 실패 케이스', () => {
    it('실패: 다른 플레이어가 비공개 시트에 대한 요청 시 403 반환', async () => {
      const { fileName, contentType } = VALID_IMAGE_CASES[0];
      await request(app.getHttpServer())
        .post(`/character-sheets/${playerParticipant.id}/presigned-url`)
        .set('Authorization', `Bearer ${otherPlayerToken}`)
        .send({ fileName, contentType })
        .expect(403);
    });

    it('실패: 존재하지 않는 participantId → 404', async () => {
      const { fileName, contentType } = VALID_IMAGE_CASES[0];
      await request(app.getHttpServer())
        .post('/character-sheets/999999/presigned-url')
        .set('Authorization', `Bearer ${playerToken}`)
        .send({ fileName, contentType })
        .expect(404);
    });

    it('실패: 지원하지 않는 MIME 타입 → 400', async () => {
      await request(app.getHttpServer())
        .post(`/character-sheets/${playerParticipant.id}/presigned-url`)
        .set('Authorization', `Bearer ${playerToken}`)
        .send({ fileName: 'doc.pdf', contentType: 'application/pdf' })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain('지원하지 않는 파일 형식입니다.');
        });
    });

    it('실패: 확장자와 MIME 타입 불일치 → 400', async () => {
      await request(app.getHttpServer())
        .post(`/character-sheets/${playerParticipant.id}/presigned-url`)
        .set('Authorization', `Bearer ${playerToken}`)
        .send({ fileName: 'fake.png', contentType: ImageMimeType.JPEG })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain(
            '파일 확장자와 MIME 타입이 일치하지 않습니다.',
          );
        });
    });
  });

  describe('EC-05: 존재하지 않는 시트에 대한 조회/수정 시도', () => {
    it('실패: 존재하지 않는 participantId로 생성 시도 시 404를 반환해야 한다', async () => {
      await request(app.getHttpServer())
        .post('/character-sheets/999999')
        .set('Authorization', `Bearer ${playerToken}`)
        .send(createCharacterSheetDto())
        .expect(404);
    });

    it('실패: 존재하지 않는 participantId에 대한 조회 요청 시 404 에러를 반환해야 한다', async () => {
      await request(app.getHttpServer())
        .get(`/character-sheets/${otherPlayerParticipant.id}`)
        .set('Authorization', `Bearer ${otherPlayerToken}`)
        .expect(404);
    });

    it('실패: 존재하지 않는 participantId에 대한 수정 요청 시 404 에러를 반환해야 한다', async () => {
      await request(app.getHttpServer())
        .patch(`/character-sheets/${otherPlayerParticipant.id}`)
        .set('Authorization', `Bearer ${otherPlayerToken}`)
        .send(updateCharacterSheetDto({ data: {} }))
        .expect(404);
    });
  });

  describe('EC-06: data 필드의 유효성 및 크기 (부분적 테스트)', () => {
    it('실패: data 필드가 객체가 아닐 경우 400 에러를 반환해야 한다', async () => {
      const createDto = {
        trpgType: TrpgSystem.DND5E,
        data: "I'm not an object",
        isPublic: false,
      };

      await request(app.getHttpServer())
        .post(`/character-sheets/${playerParticipant.id}`)
        .set('Authorization', `Bearer ${playerToken}`)
        .send(createDto)
        .expect(400);
    });
  });

  describe('EC-07: 타인의 participantId로 시트 생성 시도', () => {
    it('실패: 다른 사용자의 participantId로 시트 생성 시도 시 403 에러를 반환해야 한다', async () => {
      const createDto = createCharacterSheetDto();

      await request(app.getHttpServer())
        .post(`/character-sheets/${gmParticipant.id}`)
        .set('Authorization', `Bearer ${playerToken}`)
        .send(createDto)
        .expect(403);
    });
  });

  describe('EC-08: isPublic 필드의 불일치', () => {
    let createdSheet: CharacterSheet;

    beforeEach(async () => {
      createdSheet = await characterSheetRepository.save(
        createCharacterSheet({
          participant: playerParticipant,
          trpgType: TrpgSystem.DND5E,
          data: { name: 'Legolas' },
          isPublic: false,
        }),
      );
    });

    it('성공: isPublic 필드를 생략한 업데이트 요청은 기존 값을 유지해야 한다', async () => {
      const updateDto = updateCharacterSheetDto({
        data: { name: 'Legolas', updated: true },
      });

      const response = await request(app.getHttpServer())
        .patch(`/character-sheets/${createdSheet.participant.id}`)
        .set('Authorization', `Bearer ${playerToken}`)
        .send(updateDto)
        .expect(200);

      expect(response.body.isPublic).toBe(createdSheet.isPublic);
    });
  });
});
