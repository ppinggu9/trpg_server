// src/chat/entities/chat-message.entity.ts

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '@/users/entities/user.entity';
import { ChatRoom } from './chat-room.entity';

@Entity('chat_messages') // 테이블 이름을 명확히 구분
export class ChatMessage {
  @PrimaryGeneratedColumn()
  id: number;

  // 메시지를 보낸 사용자
  @ManyToOne(() => User)
  @JoinColumn({ name: 'sender_id' })
  sender: User;

  // 메시지가 속한 채팅방
  @ManyToOne(() => ChatRoom, (chatRoom) => chatRoom.messages)
  @JoinColumn({ name: 'chat_room_id' })
  chatRoom: ChatRoom;

  @Column({ type: 'text' })
  content: string; // 채팅 내용

  @CreateDateColumn({ name: 'sent_at' })
  sentAt: Date; // 메시지 전송 시간
}
