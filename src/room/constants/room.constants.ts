export const ROOM_MESSAGES = {
  CREATED: '방이 성공적으로 생성되었습니다.',
  JOINED: '방에 성공적으로 참가했습니다.',
  //   void로 설정해서 처음부터 메시지를 안 줄려고 했습니다.LEFT: '방을 성공적으로 나갔습니다.',
  //   DELETED: '방이 성공적으로 삭제되었습니다.',
  CREATOR_TRANSFERRED: '방장이 성공적으로 위임되었습니다.',
  ROLE_UPDATED: '참여자의 역할이 성공적으로 변경되었습니다.',
  // 추기로 방 참가자 목록 조회 또한 메시지를 작성 x
} as const;

export const ROOM_ERRORS = {
  NOT_FOUND: '방을 찾을 수 없습니다.',
  NOT_ROOM_CREATOR: '방장만이 이 작업을 수행할 수 있습니다.',
  CANNOT_LEAVE_AS_CREATOR:
    '방장은 방을 나갈 수 없습니다. 방을 나가려면 방 삭제 또는 방장 위임을 하세요.',
  MAX_PARTICIPANTS_EXCEEDED: '최대 참여자 수를 초과했습니다.',
  ALREADY_IN_ROOM: '이미 방에 참가한 사용자입니다.',
  PASSWORD_MISMATCH: '비밀번호가 일치하지 않습니다.',
  INVALID_ROLE_CHANGE: '역할 변경이 허용되지 않습니다.',
  TARGET_NOT_IN_ROOM: '대상 사용자가 방에 참가하지 않았습니다.',
  SAME_CREATOR: '현재 방장과 동일한 사용자입니다.',
  USER_NOT_FOUND: '사용자를 찾을 수 없습니다.',
  NOT_ACTIVE_USER: '활성화된 사용자가 아닙니다.',
  ROOM_ALREADY_DELETED: '이미 삭제된 방입니다.',
  ROOM_JOIN_CONFLICT: '방 참가 처리 중 다른 요청으로 인해 방이 삭제되었습니다.',

  // validate
  CANNOT_TRANSFER_TO_SELF: '자신에게 방장 권한을 위임할 수 없습니다.',
  PASSWORD_REQUIRED: '비밀번호를 입력해주세요.',
  ROOM_FULL: '방이 꽉 찼습니다.',
  INVALID_PARTICIPANT_ROLE: '유효하지 않은 참여자 역할입니다.',
} as const;

export const ROOM_PARTICIPANT_ERRORS = {
  ALREADY_PARTICIPATING: '이미 방에 참여 중입니다.',
  INVALID_PARTICIPANT_ROLE: '유효하지 않은 역할입니다.',
  PARTICIPANT_NOT_FOUND: '참여자를 찾을 수 없습니다.',
  CANNOT_TRANSFER_TO_NON_PARTICIPANT:
    '방에 참가하지 않은 사용자에게는 방장을 위임할 수 없습니다.',
  CANNOT_REMOVE_CREATOR: '방장은 방에서 제외할 수 없습니다.',
} as const;
