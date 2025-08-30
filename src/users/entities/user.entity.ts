import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToOne,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { UserRole } from './user-role.enum';
import { ApiProperty } from '@nestjs/swagger';
import { Room } from '@/room/entities/room.entity';
import { RoomParticipant } from '@/room/entities/room-participant.entity';

@Entity('users')
export class User {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ example: 'John Doe' })
  @Column({ length: 255 })
  name: string;

  @ApiProperty({ example: 'johndoe123' })
  @Column({ unique: true, length: 255 })
  nickname: string;

  @ApiProperty({ example: 'john.doe@example.com' })
  @Column({ unique: true, length: 255 })
  email: string;

  @Column({ name: 'password_hash', select: false })
  passwordHash: string;

  @ApiProperty({ enum: UserRole, default: UserRole.USER })
  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  role: UserRole;

  @ApiProperty({ example: '2024-01-01T00:00:00Z' })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-01T00:00:00Z' })
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ApiProperty({ nullable: true })
  @DeleteDateColumn()
  deletedAt: Date | null;

  // 유저가 생성한 방
  @OneToOne(() => Room, (room) => room.creator, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'created_room_id' })
  createdRoom: Room | null;

  // 유저가 참여한 방 목록
  @OneToMany(() => RoomParticipant, (participant) => participant.user)
  roomParticipant: RoomParticipant[];

  // (옵션) 현재 참여 중인 방
  @ManyToOne(() => Room)
  @JoinColumn({ name: 'current_room_id' })
  currentRoom: Room | null;
}
