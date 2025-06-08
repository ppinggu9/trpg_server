import { Room } from '../entities/room.entity';

export class RoomResponseDto {
  id: string;
  name: string;
  maxParticipants: number;
  participantCount: number;
  createdAt: string;
  updatedAt: string;

  static fromEntity(room: Room): RoomResponseDto {
    return {
      id: room.id,
      name: room.name,
      maxParticipants: room.maxParticipants,
      participantCount: room.participants.length,
      createdAt: room.createdAt.toISOString(),
      updatedAt: room.updatedAt.toISOString(),
    };
  }
}
