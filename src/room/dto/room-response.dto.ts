import { ApiProperty } from '@nestjs/swagger';
import { RoomParticipantDto } from './room-participant.dto';
import { Room } from '../entities/room.entity';

export class RoomResponseDto {
  @ApiProperty({ description: '방 ID' })
  id: string;

  @ApiProperty({ description: '방 이름' })
  name: string;

  @ApiProperty({ description: '최대 참여자 수', default: 2 })
  maxParticipants: number;

  @ApiProperty({ description: '현재 참여자 수' })
  currentParticipants: number;

  @ApiProperty({ description: '생성 시간' })
  createdAt: Date;

  @ApiProperty({ description: '수정 시간' })
  updatedAt: Date;

  @ApiProperty({ description: '삭제 여부' })
  isDeleted: boolean;

  @ApiProperty({
    description: '참여자 목록',
    type: [RoomParticipantDto],
  })
  participants: RoomParticipantDto[];

  @ApiProperty({ description: '방장 닉네임' })
  creatorNickname: string;

  static fromEntity(room: Room): RoomResponseDto {
    const participantsData =
      room.participants
        ?.filter((p) => p.leftAt === null)
        .map((p) => ({
          userId: p.user.id,
          name: p.user.name,
          nickname: p.user.nickname,
          role: p.role,
        })) || [];

    return {
      id: room.id,
      name: room.name,
      maxParticipants: room.maxParticipants,
      currentParticipants: participantsData.length,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
      isDeleted: !!room.deletedAt,
      participants: participantsData.map((p) => ({
        id: p.userId,
        name: p.name ?? '탈퇴한 사용자',
        nickname: p.nickname ?? '익명',
        role: p.role,
      })),
      creatorNickname: room.creator.nickname,
    };
  }
}
