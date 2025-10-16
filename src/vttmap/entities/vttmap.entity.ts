import { GridType } from '@/common/enums/grid-type.enum';
import { Room } from '@/room/entities/room.entity';
import { Token } from '@/token/entities/token.entity';
import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity()
export class VttMap {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  name: string;

  @Column({ nullable: true })
  imageUrl: string;

  @Column({
    type: 'enum',
    enum: GridType,
    default: GridType.SQUARE,
  })
  gridType: GridType;

  @Column({ type: 'int', default: 50 })
  gridSize: number;

  @Column({ type: 'boolean', default: true })
  showGrid: boolean;

  @ManyToOne(() => Room, (room) => room.vttmaps)
  @JoinColumn({ name: 'roomId' })
  room: Room;

  @Column({ type: 'uuid' })
  roomId: string;

  @OneToMany(() => Token, (token) => token.map)
  tokens: Token[];

  @ApiProperty({ description: '생성 시간' })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty({ description: '수정 시간' })
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ApiProperty({ description: '삭제 시간 (null이면 활성)' })
  @DeleteDateColumn()
  deletedAt: Date | null;
}
