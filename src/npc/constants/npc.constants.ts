export const NPC_MESSAGES = {
  CREATED: 'NPC가 성공적으로 생성되었습니다.',
  RETRIEVED: 'NPC를 조회했습니다.',
  UPDATED: 'NPC가 성공적으로 업데이트되었습니다.',
  DELETED: 'NPC가 삭제되었습니다.',
} as const;

export const NPC_ERRORS = {
  NOT_FOUND: 'NPC를 찾을 수 없습니다.',
  NO_PERMISSION: 'NPC를 관리할 권한이 없습니다.',
  ROOM_NOT_FOUND: '방을 찾을 수 없습니다.',
} as const;
