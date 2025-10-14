import { GridType } from '@/common/enums/grid-type.enum';
import { Room } from '@/room/entities/room.entity';
import { Token } from '@/token/entities/token.entity';
import {
  Column,
  CreateDateColumn,
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

  @ManyToOne(() => Room, (room) => room.vttmaps, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'roomId' })
  room: Room;

  @Column({ type: 'uuid' })
  roomId: string;

  @OneToMany(() => Token, (token) => token.map)
  tokens: Token[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
