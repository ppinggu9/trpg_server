import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
  ManyToMany,
} from 'typeorm';
import { UserRole } from './user-role.enum';
import { ApiProperty } from '@nestjs/swagger';
import { Room } from '@/room/entities/room.entity';

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

  @Column({ name: 'password_hash' })
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

   // 생성한 방 목록 (일대다 관계)
  @OneToMany((() => Room), (room) => room.creator) // forwardRef 직접 전달
  createdRooms: Room[];

  // 참여한 방 목록 (다대다 관계)
  @ManyToMany((() => Room), (room) => room.participants) // forwardRef 직접 전달
  joinedRooms: Room[];
}
