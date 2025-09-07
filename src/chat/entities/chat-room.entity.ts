// src/chat/entities/chat-room.entity.ts

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  OneToMany,
  OneToOne,
  JoinColumn,
  DeleteDateColumn,
} from 'typeorm';

import { User } from '@/users/entities/user.entity';
import { ChatParticipant } from './chat-participant.entity';
import { ChatMessage } from './chat-message.entity';

@Entity('chat_rooms') // 테이블 이름을 명확히 구분
export class ChatRoom {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 255, nullable: true })
  name: string;

  @Column({ default: true })
  isActive: boolean; // 방이 활성화되어 있는지

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;

  // 방 생성자
  @OneToOne(() => User)
  @JoinColumn({ name: 'creator_id' })
  creator: User;

  // 이 채팅방에 참여한 모든 사용자들
  @OneToMany(() => ChatParticipant, (participant) => participant.chatRoom, {
    cascade: true,
  })
  participants: ChatParticipant[];

  // 이 채팅방의 모든 메시지
  @OneToMany(() => ChatMessage, (message) => message.chatRoom)
  messages: ChatMessage[];
}
