import { User } from '@/users/entities/user.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';

@Entity()
export class Room {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 50, nullable: false })
  @Index('IDX_ROOM_NAME', { unique: true })
  name: string;

  @Column({ nullable: false})
  password: string;

  @Column({ default: 2, unsigned: true }) // 기본 2명
  maxParticipants: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;

  // 방 생성자
  @OneToOne((() => User), { onDelete: 'CASCADE' })
  creator: User;

  // 방 참여자
  @OneToMany(() => User, 'currentRoom', { cascade: true })
  participants: User[];
}
