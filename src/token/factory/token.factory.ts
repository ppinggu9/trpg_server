// src/token/factory/token.factory.ts
import { faker } from '@faker-js/faker';
import { v4 as uuidv4 } from 'uuid';
import { CreateTokenDto } from '../dto/create-token.dto';
import { UpdateTokenDto } from '../dto/update-token.dto';
import { Token } from '../entities/token.entity';
import { createVttMapEntity } from '@/vttmap/factory/vttmap.factory';

/**
 * 토큰 생성 DTO를 생성하는 팩토리 함수입니다.
 * 테스트 시 필요한 기본값을 자동으로 채우며, 필요한 경우 부분적으로 덮어쓸 수 있습니다.
 */
export const createTokenDto = (
  options: Partial<CreateTokenDto> = {},
): CreateTokenDto => {
  return {
    name: options.name ?? faker.lorem.word(), // 토큰 이름
    x: options.x ?? faker.number.float({ min: 0, max: 1000 }), // X 좌표
    y: options.y ?? faker.number.float({ min: 0, max: 1000 }), // Y 좌표
    scale: options.scale, // 크기 (선택 사항)
    imageUrl: options.imageUrl ?? faker.image.url(), // 이미지 URL (선택 사항)
    characterSheetId: options.characterSheetId, // 연결된 캐릭터 시트 ID (선택 사항)
    npcId: options.npcId, // 연결된 NPC ID (선택 사항)
  };
};

/**
 * 토큰 업데이트 DTO를 생성하는 팩토리 함수입니다.
 * 일부 필드만 업데이트할 때 사용합니다.
 */
export const updateTokenDto = (
  options: Partial<UpdateTokenDto> = {},
): UpdateTokenDto => {
  return {
    name: options.name,
    x: options.x ?? faker.number.float({ min: 0, max: 1000 }),
    y: options.y ?? faker.number.float({ min: 0, max: 1000 }),
    scale: options.scale,
    imageUrl: options.imageUrl,
  };
};

/**
 * Token 엔티티 인스턴스를 생성하는 팩토리 함수입니다.
 * 실제 DB 저장 없이 테스트용 객체를 만들 때 사용합니다.
 */
export const createTokenEntity = (options: Partial<Token> = {}): Token => {
  const token = new Token();

  // 기본 필드 설정
  token.id = options.id ?? uuidv4(); // UUID 자동 생성
  token.mapId = options.mapId ?? uuidv4(); // 맵 ID도 UUID
  token.name = options.name ?? faker.lorem.word();
  token.x = options.x ?? faker.number.float({ min: 0, max: 1000 });
  token.y = options.y ?? faker.number.float({ min: 0, max: 1000 });
  token.scale = options.scale ?? 1.0;
  token.imageUrl = options.imageUrl ?? faker.image.url();
  token.characterSheetId = options.characterSheetId ?? null;
  token.npcId = options.npcId ?? null;
  token.createdAt = options.createdAt ?? faker.date.past();
  token.updatedAt = options.updatedAt ?? faker.date.recent();

  // 선택적으로 전체 VttMap 객체를 연결 (깊은 테스트용)
  if (options.map !== undefined) {
    token.map = options.map;
  } else if (options.mapId) {
    // mapId만 주어졌다면 간단한 VttMap 엔티티 생성
    token.map = createVttMapEntity({ id: options.mapId });
  }

  // 사용자가 전달한 추가 옵션으로 덮어씀
  return Object.assign(token, options);
};
