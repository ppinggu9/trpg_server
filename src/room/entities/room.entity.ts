import { ApiProperty } from '@nestjs/swagger';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Check,
  OneToOne,
} from 'typeorm';
import { RoomParticipant } from './room-participant.entity';
import { User } from '@/users/entities/user.entity';

@Entity()
export class Room {
  @ApiProperty({ description: '공개 방 코드 (UUID, PK)' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: '방 이름' })
  @Column({ length: 50, nullable: false })
  name: string;

  @Column({ nullable: false })
  password: string;

  @ApiProperty({ description: '최대 참여자 수', default: 2 })
  @Column({ name: 'max_participants', default: 2 })
  @Check('"max_participants" >= 2 AND "max_participants" <= 8')
  maxParticipants: number;

  @ApiProperty({ description: '생성 시간' })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty({ description: '수정 시간' })
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ApiProperty({ description: '삭제 시간 (null이면 활성)' })
  @DeleteDateColumn()
  deletedAt: Date | null;

  // 방 참여자 목록
  @OneToMany(() => RoomParticipant, (participant) => participant.room)
  participants: RoomParticipant[];

  // 방 생성자
  @OneToOne(() => User, (user) => user.createdRoom, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  creator: User | null;
}
