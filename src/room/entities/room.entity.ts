import { User } from 'src/users/entities/user.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToMany,
  JoinTable,
  ManyToOne,
} from 'typeorm';

@Entity()
export class Room {
  // id대신에 uuid를 쓰는 이유는 'room에 uuid쓰는이유.txt'참고
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 50, nullable: false }) // 최대 50자 null허용 x
  name: string;

  @Column({ nullable: true }) // 비밀번호는 선택적
  password: string;

  @Column({ default: 2 }) // 기본 2명
  maxParticipants: number;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' }) // 생성 시간
  createdAt: Date;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' }) // 수정 시간
  updatedAt: Date;

  // 방 생성자 (User와 연관)
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  creator: User;

  // 방 참여자 (User와 다대다 관계) inverseSide: User.joinedRooms를 참조해 양방향 관계를 정의
  // inverseSide: TypeORM에서 사용하는 양방향 관계를 알려주도록 설정하는 것
  @ManyToMany(() => User, (user) => user.joinedRooms)
  @JoinTable()
  participants: User[];

  // room.entity.ts
  @Column({ type: 'varchar', default: 'ko_kr' })
  language: string;

  // 풀 스텍 검색 여기서는 null true 데이터베이스 마이그레이션에서 NOT NULL로 강제 대신 name도 강제 NOT  NULL
  // select는 필요한 경우 addselect로 명시사용
  
  // 영어용 텍스트 벡터
  @Column({ type: 'tsvector', nullable: true, select: false, insert: false, update: false })
  searchVectorEn: string;

  // 한국어용 텍스트 벡터
  @Column({ type: 'tsvector', nullable: true, select: false, insert: false, update: false })
  searchVectorKo: string;

  // 풀 스텍 검색 여기서는 null true 데이터베이스 마이그레이션에서 NOT NULL로 강제 대신 name도 강제 NOT  NULL
  // select는 필요한 경우 addselect로 명시사용
}
