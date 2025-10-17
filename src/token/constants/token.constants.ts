export enum TokenErrorCode {
  TOKEN_NOT_FOUND = 'TOKEN_NOT_FOUND',
  NOT_IN_ROOM = 'NOT_IN_ROOM',
  NO_MOVE_PERMISSION = 'NO_MOVE_PERMISSION',
  BOTH_SHEET_AND_NPC = 'BOTH_SHEET_AND_NPC',
  MAP_NOT_FOUND = 'MAP_NOT_FOUND',
}

export const TOKEN_ERROR_MESSAGES = {
  [TokenErrorCode.TOKEN_NOT_FOUND]: '토큰을 찾을 수 없습니다.',
  [TokenErrorCode.NOT_IN_ROOM]: '해당 방에 참여하고 있지 않습니다.',
  [TokenErrorCode.NO_MOVE_PERMISSION]: '이 토큰을 조작할 권한이 없습니다.',
  [TokenErrorCode.BOTH_SHEET_AND_NPC]:
    '캐릭터 시트와 NPC를 동시에 연결할 수 없습니다.',
  [TokenErrorCode.MAP_NOT_FOUND]:
    '맵을 찾을 수 없습니다. (존재하지 않거나 이미 삭제된 경우 포함)',
};
