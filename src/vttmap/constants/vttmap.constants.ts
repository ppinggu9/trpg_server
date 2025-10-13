// src/map/constants/map.constants.ts
export const VTTMAP_MESSAGES = {
  CREATED: '맵이 성공적으로 생성되었습니다.',
  UPDATED: '맵 설정이 성공적으로 업데이트되었습니다.',
  RETRIEVED: '맵 정보를 성공적으로 조회했습니다.',
} as const;

export const VTTMAP_ERRORS = {
  NOT_FOUND: '맵을 찾을 수 없습니다.',
  ALREADY_EXISTS: '이미 맵이 존재합니다.',
  NOT_ROOM_CREATOR: '방장(GM)만 맵을 설정할 수 있습니다.',
  PARTICIPANT_NOT_IN_ROOM: '해당 방에 참여하지 않았습니다.',
  INVALID_GRID_SIZE: '그리드 크기는 10 이상 200 이하여야 합니다.',
} as const;
