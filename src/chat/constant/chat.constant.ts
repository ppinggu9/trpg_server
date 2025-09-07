export const CHAT_ERRORS = {
  INVALID_PARTICIPANT: '유효한 참여자가 아닙니다.',
  NON_EXISTED_USER: '존재하는 유저가 아닙니다.',
  NON_EXISTED_USER_WITH_ID: (userId: number) =>
    `유저 ${userId}는 이 방에 존재하는 유저가 아닙니다.`,

  ROOM_NOT_FOUND: '채팅방을 찾을 수 없습니다.',
  ONLY_CREATOR_CAN_DELETE: '방장만 채팅방을 삭제할 수 있습니다.',
  ONLY_CREATOR_CAN_INVITE: '방장만 사용자를 초대할 수 있습니다.',
  USER_ALREADY_PARTICIPANT: '해당 사용자는 이미 채팅방에 참여 중입니다.',

  CANNOT_REMOVE_USER: '해당 사용자를 퇴장시킬 권한이 없습니다.',
  USER_NOT_IN_ROOM: '해당 사용자는 현재 채팅방에 없습니다.',

  CREATOR_CANNOT_SELF_REMOVE:
    '방장은 자신을 퇴장시킬 수 없습니다. 방을 삭제하려면 채팅방 삭제 기능을 사용하세요.',

  INTERNAL_SERVER_ERROR: '서버 내부 오류가 발생했습니다.',
} as const;
