export enum TokenErrorCode {
  TOKEN_NOT_FOUND = 'TOKEN_NOT_FOUND',
  NOT_IN_ROOM = 'NOT_IN_ROOM',
  NO_MOVE_PERMISSION = 'NO_MOVE_PERMISSION',
  BOTH_SHEET_AND_NPC = 'BOTH_SHEET_AND_NPC',
  MAP_NOT_FOUND = 'MAP_NOT_FOUND',
}

export const TOKEN_ERROR_MESSAGES = {
  [TokenErrorCode.TOKEN_NOT_FOUND]: 'Token not found',
  [TokenErrorCode.NOT_IN_ROOM]: 'You are not in this room',
  [TokenErrorCode.NO_MOVE_PERMISSION]: 'You cannot move this token',
  [TokenErrorCode.BOTH_SHEET_AND_NPC]:
    'Token cannot link to both character sheet and NPC',
  [TokenErrorCode.MAP_NOT_FOUND]: 'Map not found',
};
