import { TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '@/users/entities/user.entity';
import { DataSource, Repository } from 'typeorm';
import { createUserDto } from '@/users/factory/user.factory';
import {
  setupTestApp,
  signUpAndLogin,
  truncateAllTables,
} from './utils/test.util';
import { Room } from '@/room/entities/room.entity';
import { VttMap } from '@/vttmap/entities/vttmap.entity';
import { CharacterSheet } from '@/character-sheet/entities/character-sheet.entity';
import { Npc } from '@/npc/entities/npc.entity';
import { Token } from '@/token/entities/token.entity';
import { RoomService } from '@/room/room.service';
import { VttMapService } from '@/vttmap/vttmap.service';
import { TrpgSystem } from '@/common/enums/trpg-system.enum';
import { ParticipantRole } from '@/common/enums/participant-role.enum';
import {
  TOKEN_ERROR_MESSAGES,
  TokenErrorCode,
} from '@/token/constants/token.constants';
import { RoomParticipant } from '@/room/entities/room-participant.entity';
import { NpcType } from '@/common/enums/npc-type.enum';
import { GridType } from '@/common/enums/grid-type.enum';
import {
  createTokenDto,
  createTokenEntity,
  updateTokenDto,
} from '@/token/factory/token.factory';
import { createCharacterSheet } from '@/character-sheet/factory/character-sheet.factory';
import { createNpcEntity } from '@/npc/factory/npc.factory';

describe('TokenController (e2e)', () => {
  let app: INestApplication;
  let module: TestingModule;
  let dataSource: DataSource;

  // Repositories
  let userRepository: Repository<User>;
  let roomRepository: Repository<Room>;
  let characterSheetRepository: Repository<CharacterSheet>;
  let npcRepository: Repository<Npc>;
  let tokenRepository: Repository<Token>;

  // Services
  let roomService: RoomService;
  let vttMapService: VttMapService;

  // Users
  let playerUser: User;
  let gmUser: User;
  let otherPlayerUser: User;
  let playerToken: string;
  let gmToken: string;

  // Room & Map
  let testRoom: Room;
  let testMap: VttMap;

  // Participants
  let playerParticipant: RoomParticipant;
  let otherPlayerParticipant: RoomParticipant;

  beforeAll(async () => {
    const testApp = await setupTestApp();
    ({ app, module, dataSource } = testApp);

    userRepository = module.get(getRepositoryToken(User));
    roomRepository = module.get(getRepositoryToken(Room));
    characterSheetRepository = module.get(getRepositoryToken(CharacterSheet));
    npcRepository = module.get(getRepositoryToken(Npc));
    tokenRepository = module.get(getRepositoryToken(Token));

    roomService = module.get(RoomService);
    vttMapService = module.get(VttMapService);
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
        name: 'Token Test Room',
        password: 'test1234',
        maxParticipants: 5,
      },
      gmUser.id,
    );

    testRoom = await roomRepository.findOne({
      where: { name: 'Token Test Room' },
      relations: ['creator', 'participants', 'participants.user'],
    });

    await roomService.updateParticipantRole(
      testRoom.id,
      gmUser.id, // currentUserId (방장 자신)
      gmUser.id, // targetUserId (자기 자신)
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
    )!;
    otherPlayerParticipant = testRoom.participants.find(
      (p) => p.user.id === otherPlayerUser.id,
    )!;

    // 맵 생성 (GM만 가능)
    const vttmapDto = {
      name: 'Test Map',
      gridType: GridType.SQUARE,
      gridSize: 50,
      showGrid: true,
    };
    const { vttMap } = await vttMapService.createVttMap(
      testRoom.id,
      gmUser.id,
      vttmapDto,
    );
    testMap = vttMap;
  });

  describe('UC-01: 토큰 생성', () => {
    it('성공: GM이 일반 토큰(이미지)을 생성할 수 있어야 한다', async () => {
      const createDto = createTokenDto({
        name: 'Treasure Chest',
        x: 100,
        y: 200,
        scale: 1.2,
        imageUrl: 'https://example.com/chest.png  ',
      });

      const res = await request(app.getHttpServer())
        .post(`/tokens/maps/${testMap.id}`)
        .set('Authorization', `Bearer ${gmToken}`)
        .send(createDto)
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.mapId).toBe(testMap.id);
      expect(res.body.name).toBe('Treasure Chest');
      expect(res.body.imageUrl).toBe('https://example.com/chest.png  ');
      expect(res.body.characterSheetId).toBeNull();
      expect(res.body.npcId).toBeNull();
    });

    it('성공: GM이 캐릭터 시트에 연결된 토큰을 생성할 수 있어야 한다', async () => {
      const sheet = await characterSheetRepository.save(
        createCharacterSheet({
          participant: playerParticipant,
          trpgType: TrpgSystem.DND5E,
          data: { name: 'Legolas' },
          isPublic: false,
        }),
      );

      const createDto = createTokenDto({
        name: 'Legolas Token',
        x: 300,
        y: 400,
        characterSheetId: Number(sheet.id),
      });

      const res = await request(app.getHttpServer())
        .post(`/tokens/maps/${testMap.id}`)
        .set('Authorization', `Bearer ${gmToken}`)
        .send(createDto)
        .expect(201);

      expect(res.body.characterSheetId).toBe(Number(sheet.id));
      expect(res.body.npcId).toBeNull();
    });

    it('성공: GM이 NPC에 연결된 토큰을 생성할 수 있어야 한다', async () => {
      const npc = await npcRepository.save(
        createNpcEntity({
          room: testRoom,
          trpgType: TrpgSystem.DND5E,
          data: { name: 'Goblin' },
          isPublic: true,
          type: NpcType.NPC,
        }),
      );

      const createDto = createTokenDto({
        name: 'Goblin Token',
        x: 500,
        y: 600,
        npcId: Number(npc.id),
      });

      const res = await request(app.getHttpServer())
        .post(`/tokens/maps/${testMap.id}`)
        .set('Authorization', `Bearer ${gmToken}`)
        .send(createDto)
        .expect(201);

      expect(res.body.npcId).toBe(Number(npc.id));
      expect(res.body.characterSheetId).toBeNull();
    });

    it('실패: x가 문자열이면 400 에러', async () => {
      await request(app.getHttpServer())
        .post(`/tokens/maps/${testMap.id}`)
        .set('Authorization', `Bearer ${gmToken}`)
        .send({ name: 'Bad', x: 'not-a-number', y: 100 })
        .expect(400);
    });

    it('실패: name이 누락되면 400 에러', async () => {
      await request(app.getHttpServer())
        .post(`/tokens/maps/${testMap.id}`)
        .set('Authorization', `Bearer ${gmToken}`)
        .send({ x: 100, y: 100 })
        .expect(400);
    });

    it('실패: 캐릭터 시트와 NPC를 동시에 연결할 수 없음 (400)', async () => {
      const sheet = await characterSheetRepository.save(
        createCharacterSheet({
          participant: playerParticipant,
          trpgType: TrpgSystem.DND5E,
        }),
      );
      const npc = await npcRepository.save(
        createNpcEntity({
          room: testRoom,
          trpgType: TrpgSystem.DND5E,
          isPublic: true,
        }),
      );

      const createDto = createTokenDto({
        name: 'Invalid Token',
        x: 0,
        y: 0,
        characterSheetId: Number(sheet.id),
        npcId: Number(npc.id),
      });

      await request(app.getHttpServer())
        .post(`/tokens/maps/${testMap.id}`)
        .set('Authorization', `Bearer ${gmToken}`)
        .send(createDto)
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toBe(
            TOKEN_ERROR_MESSAGES[TokenErrorCode.BOTH_SHEET_AND_NPC],
          );
        });
    });
    describe('플레이어 토큰 생성 권한', () => {
      it('성공: 플레이어가 자신의 캐릭터 시트에 연결된 토큰을 생성할 수 있어야 한다', async () => {
        // 1. 플레이어의 캐릭터 시트 생성 (GM이 생성한 방에 참여 중인 플레이어)
        const sheet = await characterSheetRepository.save(
          createCharacterSheet({
            participant: playerParticipant,
            trpgType: TrpgSystem.DND5E,
            data: { name: 'Player Hero' },
            isPublic: false,
          }),
        );

        // 2. 플레이어가 해당 시트로 토큰 생성 요청
        const createDto = createTokenDto({
          name: 'My Hero Token',
          x: 200,
          y: 300,
          characterSheetId: Number(sheet.id),
        });

        const res = await request(app.getHttpServer())
          .post(`/tokens/maps/${testMap.id}`)
          .set('Authorization', `Bearer ${playerToken}`)
          .send(createDto)
          .expect(201);

        expect(res.body.characterSheetId).toBe(Number(sheet.id));
        expect(res.body.npcId).toBeNull();
        expect(res.body.mapId).toBe(testMap.id);
      });

      it('실패: 플레이어가 일반 토큰(이미지만 있는)을 생성하려 하면 403 에러', async () => {
        const createDto = createTokenDto({
          name: 'Plain Chest',
          x: 100,
          y: 100,
          imageUrl: 'https://example.com/chest.png',
        });

        await request(app.getHttpServer())
          .post(`/tokens/maps/${testMap.id}`)
          .set('Authorization', `Bearer ${playerToken}`)
          .send(createDto)
          .expect(403)
          .expect((res) => {
            expect(res.body.message).toBe(
              '플레이어는 자신의 캐릭터 시트 토큰만 생성할 수 있습니다.',
            );
          });
      });

      it('실패: 플레이어가 NPC 토큰을 생성하려 하면 403 에러', async () => {
        const npc = await npcRepository.save(
          createNpcEntity({
            room: testRoom,
            trpgType: TrpgSystem.DND5E,
            data: { name: 'Orc' },
            isPublic: true,
            type: NpcType.NPC,
          }),
        );

        const createDto = createTokenDto({
          name: 'Orc Token',
          x: 400,
          y: 500,
          npcId: Number(npc.id),
        });

        await request(app.getHttpServer())
          .post(`/tokens/maps/${testMap.id}`)
          .set('Authorization', `Bearer ${playerToken}`)
          .send(createDto)
          .expect(403)
          .expect((res) => {
            expect(res.body.message).toBe(
              '플레이어는 자신의 캐릭터 시트 토큰만 생성할 수 있습니다.',
            );
          });
      });

      it('실패: 플레이어가 다른 플레이어의 캐릭터 시트로 토큰을 생성하려 하면 403 에러', async () => {
        // 다른 플레이어의 캐릭터 시트 생성
        const otherSheet = await characterSheetRepository.save(
          createCharacterSheet({
            participant: otherPlayerParticipant,
            trpgType: TrpgSystem.DND5E,
            data: { name: 'Other Hero' },
          }),
        );

        const createDto = createTokenDto({
          name: 'Impersonation Token',
          x: 0,
          y: 0,
          characterSheetId: Number(otherSheet.id),
        });

        await request(app.getHttpServer())
          .post(`/tokens/maps/${testMap.id}`)
          .set('Authorization', `Bearer ${playerToken}`)
          .send(createDto)
          .expect(403)
          .expect((res) => {
            expect(res.body.message).toBe(
              TOKEN_ERROR_MESSAGES[TokenErrorCode.NO_MOVE_PERMISSION],
            );
          });
      });
    });
  });

  describe('UC-02: 토큰 조회', () => {
    let tokenId: string;

    beforeEach(async () => {
      const createDto = createTokenDto({
        name: 'Test Token',
        x: 100,
        y: 100,
      });
      const res = await request(app.getHttpServer())
        .post(`/tokens/maps/${testMap.id}`)
        .set('Authorization', `Bearer ${gmToken}`)
        .send(createDto)
        .expect(201);
      tokenId = res.body.id;
    });

    it('성공: GM은 맵의 모든 토큰을 조회할 수 있어야 한다', async () => {
      const res = await request(app.getHttpServer())
        .get(`/tokens/maps/${testMap.id}`)
        .set('Authorization', `Bearer ${gmToken}`)
        .expect(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].id).toBe(tokenId);
    });

    it('성공: 플레이어도 맵의 모든 토큰을 조회할 수 있어야 한다', async () => {
      const res = await request(app.getHttpServer())
        .get(`/tokens/maps/${testMap.id}`)
        .set('Authorization', `Bearer ${playerToken}`)
        .expect(200);
      expect(res.body.length).toBe(1);
    });

    it('성공: Soft Delete된 토큰은 조회되지 않음', async () => {
      const res = await request(app.getHttpServer())
        .post(`/tokens/maps/${testMap.id}`)
        .set('Authorization', `Bearer ${gmToken}`)
        .send(createTokenDto({ name: 'To Hide' }))
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/tokens/${res.body.id}`)
        .set('Authorization', `Bearer ${gmToken}`)
        .expect(204);

      const list = await request(app.getHttpServer())
        .get(`/tokens/maps/${testMap.id}`)
        .set('Authorization', `Bearer ${gmToken}`)
        .expect(200);

      expect(list.body.some((t: any) => t.id === res.body.id)).toBe(false);
    });

    it('실패: 방에 참여하지 않은 사용자는 조회 불가 (403)', async () => {
      const outsiderToken = await signUpAndLogin(app, createUserDto());
      await request(app.getHttpServer())
        .get(`/tokens/maps/${testMap.id}`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .expect(403)
        .expect((res) => {
          expect(res.body.message).toBe(
            TOKEN_ERROR_MESSAGES[TokenErrorCode.NOT_IN_ROOM],
          );
        });
    });
  });

  describe('UC-03: 토큰 이동 (업데이트)', () => {
    let characterTokenId: string;
    let npcTokenId: string;
    let plainTokenId: string;

    beforeEach(async () => {
      // 캐릭터 시트 생성
      const sheet = await characterSheetRepository.save(
        createCharacterSheet({
          participant: playerParticipant,
          trpgType: TrpgSystem.DND5E,
        }),
      );
      const npc = await npcRepository.save(
        createNpcEntity({
          room: testRoom,
          trpgType: TrpgSystem.DND5E,
          isPublic: true,
        }),
      );

      const charRes = await request(app.getHttpServer())
        .post(`/tokens/maps/${testMap.id}`)
        .set('Authorization', `Bearer ${gmToken}`)
        .send(
          createTokenDto({ name: 'Char', characterSheetId: Number(sheet.id) }),
        )
        .expect(201);
      characterTokenId = charRes.body.id;

      const npcRes = await request(app.getHttpServer())
        .post(`/tokens/maps/${testMap.id}`)
        .set('Authorization', `Bearer ${gmToken}`)
        .send(createTokenDto({ name: 'NPC', npcId: Number(npc.id) }))
        .expect(201);
      npcTokenId = npcRes.body.id;

      const plainRes = await request(app.getHttpServer())
        .post(`/tokens/maps/${testMap.id}`)
        .set('Authorization', `Bearer ${gmToken}`)
        .send(createTokenDto({ name: 'Plain' }))
        .expect(201);
      plainTokenId = plainRes.body.id;
    });

    it('성공: GM은 모든 토큰을 이동할 수 있어야 한다', async () => {
      const updateDto = updateTokenDto({ x: 999, y: 888 });
      await request(app.getHttpServer())
        .patch(`/tokens/${plainTokenId}`)
        .set('Authorization', `Bearer ${gmToken}`)
        .send(updateDto)
        .expect(200)
        .expect((res) => {
          expect(res.body.x).toBe(999);
          expect(res.body.y).toBe(888);
        });
    });

    it('성공: 플레이어는 자신의 캐릭터 토큰만 이동할 수 있어야 한다', async () => {
      const updateDto = updateTokenDto({ x: 500, y: 500 });
      await request(app.getHttpServer())
        .patch(`/tokens/${characterTokenId}`)
        .set('Authorization', `Bearer ${playerToken}`)
        .send(updateDto)
        .expect(200)
        .expect((res) => {
          expect(res.body.x).toBe(500);
        });
    });

    it('성공: GM은 다른 플레이어의 캐릭터 토큰도 이동 가능', async () => {
      const otherSheet = await characterSheetRepository.save(
        createCharacterSheet({
          participant: otherPlayerParticipant,
          trpgType: TrpgSystem.DND5E,
        }),
      );
      const otherToken = await tokenRepository.save(
        createTokenEntity({
          mapId: testMap.id,
          characterSheetId: Number(otherSheet.id),
        }),
      );

      await request(app.getHttpServer())
        .patch(`/tokens/${otherToken.id}`)
        .set('Authorization', `Bearer ${gmToken}`)
        .send({ x: 999, y: 999 })
        .expect(200);
    });

    it('성공: GM이 토큰의 name과 imageUrl을 부분 업데이트 가능', async () => {
      const updateDto = {
        name: 'Updated Chest',
        imageUrl: 'https://new.com/token.png',
      };
      const res = await request(app.getHttpServer())
        .patch(`/tokens/${plainTokenId}`)
        .set('Authorization', `Bearer ${gmToken}`)
        .send(updateDto)
        .expect(200);

      expect(res.body.name).toBe('Updated Chest');
      expect(res.body.imageUrl).toBe('https://new.com/token.png');
    });

    it('실패: 플레이어는 NPC 토큰을 이동할 수 없음 (403)', async () => {
      await request(app.getHttpServer())
        .patch(`/tokens/${npcTokenId}`)
        .set('Authorization', `Bearer ${playerToken}`)
        .send(updateTokenDto({ x: 0, y: 0 }))
        .expect(403)
        .expect((res) => {
          expect(res.body.message).toBe(
            TOKEN_ERROR_MESSAGES[TokenErrorCode.NO_MOVE_PERMISSION],
          );
        });
    });

    it('실패: 플레이어는 일반 토큰을 이동할 수 없음 (403)', async () => {
      await request(app.getHttpServer())
        .patch(`/tokens/${plainTokenId}`)
        .set('Authorization', `Bearer ${playerToken}`)
        .send(updateTokenDto({ x: 0, y: 0 }))
        .expect(403)
        .expect((res) => {
          expect(res.body.message).toBe(
            TOKEN_ERROR_MESSAGES[TokenErrorCode.NO_MOVE_PERMISSION],
          );
        });
    });

    it('실패: 다른 플레이어의 캐릭터 토큰도 이동 불가 (403)', async () => {
      const otherSheet = await characterSheetRepository.save(
        createCharacterSheet({
          participant: otherPlayerParticipant,
          trpgType: TrpgSystem.DND5E,
        }),
      );
      const otherToken = await tokenRepository.save(
        createTokenEntity({
          mapId: testMap.id,
          name: 'Other Char',
          x: 0,
          y: 0,
          characterSheetId: Number(otherSheet.id),
        }),
      );

      await request(app.getHttpServer())
        .patch(`/tokens/${otherToken.id}`)
        .set('Authorization', `Bearer ${playerToken}`)
        .send(updateTokenDto({ x: 100, y: 100 }))
        .expect(403)
        .expect((res) => {
          expect(res.body.message).toBe(
            TOKEN_ERROR_MESSAGES[TokenErrorCode.NO_MOVE_PERMISSION],
          );
        });
    });
  });

  describe('UC-04: 토큰 삭제', () => {
    let tokenId: string;

    beforeEach(async () => {
      const res = await request(app.getHttpServer())
        .post(`/tokens/maps/${testMap.id}`)
        .set('Authorization', `Bearer ${gmToken}`)
        .send(createTokenDto({ name: 'To Delete' }))
        .expect(201);
      tokenId = res.body.id;
    });

    it('성공: GM은 토큰을 Soft Delete할 수 있어야 한다', async () => {
      await request(app.getHttpServer())
        .delete(`/tokens/${tokenId}`)
        .set('Authorization', `Bearer ${gmToken}`)
        .expect(204);

      const deleted = await tokenRepository.findOneBy({ id: tokenId });
      expect(deleted).toBeNull();

      const softDeleted = await tokenRepository.findOne({
        where: { id: tokenId },
        withDeleted: true, // 삭제된 것도 포함
      });
      expect(softDeleted).not.toBeNull();
      expect(softDeleted!.deletedAt).toBeInstanceOf(Date);
    });

    it('성공: GM은 다른 플레이어의 캐릭터 토큰도 삭제 가능', async () => {
      const otherSheet = await characterSheetRepository.save(
        createCharacterSheet({
          participant: otherPlayerParticipant,
          trpgType: TrpgSystem.DND5E,
        }),
      );
      const otherToken = await tokenRepository.save(
        createTokenEntity({
          mapId: testMap.id,
          characterSheetId: Number(otherSheet.id),
        }),
      );

      await request(app.getHttpServer())
        .delete(`/tokens/${otherToken.id}`)
        .set('Authorization', `Bearer ${gmToken}`)
        .expect(204);

      const softDeleted = await tokenRepository.findOne({
        where: { id: otherToken.id },
        withDeleted: true,
      });
      expect(softDeleted).not.toBeNull();
      expect(softDeleted!.deletedAt).toBeInstanceOf(Date);
    });

    it('실패: 플레이어는 일반 토큰 삭제 불가 (403)', async () => {
      await request(app.getHttpServer())
        .delete(`/tokens/${tokenId}`)
        .set('Authorization', `Bearer ${playerToken}`)
        .expect(403)
        .expect((res) => {
          expect(res.body.message).toBe(
            TOKEN_ERROR_MESSAGES[TokenErrorCode.NO_MOVE_PERMISSION],
          );
        });
    });
  });

  describe('EC-01: 존재하지 않는 리소스', () => {
    it('실패: 존재하지 않는 맵에 토큰 생성 시도 → 404', async () => {
      const fakeMapId = '123e4567-e89b-12d3-a456-426614174000';
      await request(app.getHttpServer())
        .post(`/tokens/maps/${fakeMapId}`)
        .set('Authorization', `Bearer ${gmToken}`)
        .send(createTokenDto({ name: 'Fake', x: 0, y: 0 }))
        .expect(404)
        .expect((res) => {
          expect(res.body.message).toBe(
            TOKEN_ERROR_MESSAGES[TokenErrorCode.MAP_NOT_FOUND],
          );
        });
    });

    it('실패: 존재하지 않는 토큰 업데이트 시도 → 404', async () => {
      const fakeTokenId = '123e4567-e89b-12d3-a456-426614174000';
      await request(app.getHttpServer())
        .patch(`/tokens/${fakeTokenId}`)
        .set('Authorization', `Bearer ${gmToken}`)
        .send(updateTokenDto({ x: 0, y: 0 }))
        .expect(404)
        .expect((res) => {
          expect(res.body.message).toBe(
            TOKEN_ERROR_MESSAGES[TokenErrorCode.TOKEN_NOT_FOUND],
          );
        });
    });
  });

  describe('EC-02: 권한 없는 요청', () => {
    it('실패: 인증되지 않은 사용자가 토큰 생성 시도 → 401', async () => {
      await request(app.getHttpServer())
        .post(`/tokens/maps/${testMap.id}`)
        .send(createTokenDto({ name: 'Hacker', x: 0, y: 0 }))
        .expect(401);
    });

    it('실패: 방에 없는 사용자가 토큰 조회 시도 → 403', async () => {
      const outsiderToken = await signUpAndLogin(app, createUserDto());
      await request(app.getHttpServer())
        .get(`/tokens/maps/${testMap.id}`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .expect(403)
        .expect((res) => {
          expect(res.body.message).toBe(
            TOKEN_ERROR_MESSAGES[TokenErrorCode.NOT_IN_ROOM],
          );
        });
    });
  });
});
