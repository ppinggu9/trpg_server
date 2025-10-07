// src/npc/entities/npc.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Room } from '@/room/entities/room.entity';
import { TrpgSystem } from '@/common/enums/trpg-system.enum';
import { ApiProperty } from '@nestjs/swagger';
import { NpcType } from '@/common/enums/npc-type.enum';

@Entity('npcs')
export class Npc {
  @ApiProperty({ example: 1, description: 'NPC 고유 ID' })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({
    enum: NpcType,
    description: 'NPC 또는 몬스터 타입',
    default: NpcType.NPC,
  })
  @Column({
    type: 'varchar',
    length: 20,
    default: NpcType.NPC,
  })
  type: NpcType;

  @ApiProperty({
    type: Object,
    description: 'TRPG NPC/몬스터 데이터 (프론트엔드에서 계산된 모든 값 포함)',
  })
  @Column('jsonb')
  data: object;

  @ApiProperty({
    enum: TrpgSystem,
    description: '룰북 타입 (dnd5e, coc7e 등)',
  })
  @Column({
    type: 'varchar',
    length: 50,
  })
  trpgType: TrpgSystem;

  @ApiProperty({
    example: false,
    description: '다른 플레이어가 볼 수 있는지 여부 (GM 전용 설정)',
  })
  @Column({ default: false })
  isPublic: boolean;

  @ManyToOne(() => Room)
  @JoinColumn({ name: 'room_id' })
  room: Room;

  @Column({ name: 'room_id', type: 'uuid' })
  roomId: string;

  @ApiProperty({ description: '생성 시간' })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty({ description: '수정 시간' })
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
