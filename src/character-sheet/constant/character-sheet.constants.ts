// src/charactersheet/constants/character-sheet.constants.ts

export const CHARACTER_SHEET_MESSAGES = {
  CREATED: '캐릭터 시트가 성공적으로 생성되었습니다.',
  RETRIEVED: '캐릭터 시트를 조회했습니다.',
  UPDATED: '캐릭터 시트가 성공적으로 업데이트되었습니다.',
} as const;

export const CHARACTER_SHEET_ERRORS = {
  PARTICIPANT_NOT_FOUND: '참가자를 찾을 수 없습니다.',
  SHEET_ALREADY_EXISTS: '이미 캐릭터 시트가 존재합니다.',
  SHEET_NOT_FOUND: '캐릭터 시트를 찾을 수 없습니다.',
  NO_READ_PERMISSION: '이 캐릭터 시트를 볼 권한이 없습니다.',
  NO_WRITE_PERMISSION: '이 캐릭터 시트를 수정할 권한이 없습니다.',
  PUBLIC_UPDATE_RESTRICTED: '시트 공개 여부는 GM만 변경할 수 있습니다.',
} as const;
