// src/charactersheet/entities/character-sheet.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RoomParticipant } from '@/room/entities/room-participant.entity';
import { TrpgSystem } from '@/common/enums/trpg-system.enum';
import { ApiProperty } from '@nestjs/swagger';

@Entity('character_sheets')
export class CharacterSheet {
  @ApiProperty({ example: 1, description: '캐릭터 시트 고유 ID' })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({
    type: Object,
    description: 'TRPG 시트 데이터 (프론트엔드에서 계산된 모든 값 포함)',
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

  @OneToOne(() => RoomParticipant, {})
  @JoinColumn()
  participant: RoomParticipant;

  @ApiProperty({ description: '생성 시간' })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty({ description: '수정 시간' })
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // @ApiProperty({ description: '삭제 시간 (null이면 활성)' })
  // @DeleteDateColumn()
  // deletedAt: Date | null;
}
