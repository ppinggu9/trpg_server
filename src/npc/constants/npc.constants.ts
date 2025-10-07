// src/npc/constants/npc.constants.ts
export const NPC_MESSAGES = {
  CREATED: 'NPC가 성공적으로 생성되었습니다.',
  RETRIEVED: 'NPC를 조회했습니다.',
  UPDATED: 'NPC가 성공적으로 업데이트되었습니다.',
  DELETED: 'NPC가 삭제되었습니다.',
} as const;

export const NPC_ERRORS = {
  NOT_FOUND: 'NPC를 찾을 수 없습니다.',
  GM_REQUIRED: '이 작업은 GM만 가능합니다.',
  READ_FORBIDDEN: '비공개 NPC는 GM만 조회할 수 있습니다.',
  PARTICIPANT_NOT_IN_ROOM: '해당 방에 참여하고 있지 않습니다.',
} as const;
