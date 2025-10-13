import { GridType } from '@/common/enums/grid-type.enum';
import { Room } from '@/room/entities/room.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
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

  @OneToOne(() => Room, (room) => room.vttmap, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'roomId' })
  room: Room;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
