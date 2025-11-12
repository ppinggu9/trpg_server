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

@Entity('chat_participants')
export class ChatParticipant {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, (user) => user.chatParticipants)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => ChatRoom, (chatRoom) => chatRoom.participants)
  @JoinColumn({ name: 'chat_room_id' })
  chatRoom: ChatRoom;

  @CreateDateColumn({ name: 'joined_at' })
  joinedAt: Date;

  @Column({ type: 'int', nullable: true })
  lastReadMessageId: number | null;

  @DeleteDateColumn({ name: 'left_at' })
  leftAt: Date | null;
}
