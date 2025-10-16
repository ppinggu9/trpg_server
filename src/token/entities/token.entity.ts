import { VttMap } from '@/vttmap/entities/vttmap.entity';
import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
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

  @ManyToOne(() => VttMap, (map) => map.tokens)
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
