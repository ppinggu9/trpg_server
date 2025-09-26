import {
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  Column,
  OneToOne,
} from 'typeorm';
import { Room } from './room.entity';
import { User } from '@/users/entities/user.entity';
import { ApiProperty } from '@nestjs/swagger';
import { ParticipantRole } from '@/common/enums/participant-role.enum';
import { CharacterSheet } from '@/character-sheet/entities/character-sheet.entity';

@Entity()
export class RoomParticipant {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Room, (room) => room.participants)
  room: Room;

  @ManyToOne(() => User, (user) => user.roomParticipant)
  user: User;

  @ApiProperty({
    description: '참여자 역할',
    enum: ParticipantRole,
    default: ParticipantRole.PLAYER,
  })
  @Column({
    type: 'enum',
    enum: ParticipantRole,
    default: ParticipantRole.PLAYER,
  })
  role: ParticipantRole;

  @ApiProperty({ description: '참여 시작 시간' })
  @CreateDateColumn()
  joinedAt: Date;

  @ApiProperty({ description: '참여 종료 시간 (null이면 활성)' })
  @DeleteDateColumn()
  leftAt: Date | null;

  @OneToOne(
    () => CharacterSheet,
    (characterSheet) => characterSheet.participant,
    {},
  )
  characterSheet: CharacterSheet;
}
