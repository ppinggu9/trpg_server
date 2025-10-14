import { VttMap } from '@/vttmap/entities/vttmap.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity()
export class Token {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  mapId: string;

  @ManyToOne(() => VttMap, (map) => map.tokens, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'mapId' })
  map: VttMap;

  @Column()
  name: string;

  @Column({ type: 'float', default: 0 })
  x: number;

  @Column({ type: 'float', default: 0 })
  y: number;

  @Column({ type: 'float', default: 1.0 })
  scale: number;

  @Column({ nullable: true })
  imageUrl?: string;

  @Column({ type: 'int', nullable: true })
  characterSheetId?: number;

  @Column({ type: 'int', nullable: true })
  npcId?: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
