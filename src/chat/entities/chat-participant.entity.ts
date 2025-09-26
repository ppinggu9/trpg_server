// src/chat/entities/chat-participant.entity.ts

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  DeleteDateColumn,
} from 'typeorm';
import { User } from '@/users/entities/user.entity';
import { ChatRoom } from './chat-room.entity';

@Entity('chat_participants') // 테이블 이름을 명확히 구분
export class ChatParticipant {
  @PrimaryGeneratedColumn()
  id: number;

  // 참여한 사용자
  @ManyToOne(() => User, (user) => user.chatParticipants) // User 엔티티에 연결 필드 필요
  @JoinColumn({ name: 'user_id' })
  user: User;

  // 참여한 채팅방
  @ManyToOne(() => ChatRoom, (chatRoom) => chatRoom.participants)
  @JoinColumn({ name: 'chat_room_id' })
  chatRoom: ChatRoom;

  @CreateDateColumn({ name: 'joined_at' })
  joinedAt: Date;

  // 마지막으로 읽은 메시지 ID (안읽은 메시지 카운트용)
  @Column({ type: 'int', nullable: true })
  lastReadMessageId: number | null;

  @DeleteDateColumn({ name: 'left_at' })
  leftAt: Date | null;
}
