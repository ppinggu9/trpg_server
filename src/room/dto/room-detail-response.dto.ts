import { Room } from '../entities/room.entity';

export class RoomDetailResponseDto {
  id: string;
  name: string;
  maxParticipants: number;
  participantCount: number;
  creatorId: number;
  creatorNickname: string;
  createdAt: string;
  updatedAt: string;

  static fromEntity(room: Room): RoomDetailResponseDto {
    return {
      id: room.id,
      name: room.name,
      maxParticipants: room.maxParticipants,
      participantCount: room.participants.length,
      creatorId: room.creator.id,
      creatorNickname: room.creator.nickname,
      createdAt: room.createdAt.toISOString(),
      updatedAt: room.updatedAt.toISOString(),
    };
  }
}
