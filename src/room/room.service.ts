import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateRoomDto } from './dto/create-room.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { Room } from './entities/room.entity';
import { User } from 'src/users/entities/user.entity';
import { compare, hash } from 'bcryptjs';
import { ConfigService } from '@nestjs/config';

// 🔽 DTO import 추가
import { RoomDetailResponseDto } from './dto/room-detail-response.dto';

@Injectable()
export class RoomService {
  private failedLoginAttempts = new Map<
    string,
    { count: number; timestamp: number }
  >();

  constructor(
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  // 방 생성
  // 🔁 Room 생성 후 DTO 반환
  async createRoom(
    dto: CreateRoomDto,
    creatorId: number,
  ): Promise<RoomDetailResponseDto> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const creator = await this.userRepository.findOneBy({ id: creatorId });
      if (!creator) {
        throw new NotFoundException('User not found');
      }

      const hashedPassword = dto.password
        ? await hash(dto.password, 10)
        : undefined;

      const room = queryRunner.manager.create(Room, {
        name: dto.name,
        password: hashedPassword,
        maxParticipants: dto.maxParticipants,
        creator,
        participants: [creator],
      });

      const savedRoom = await queryRunner.manager.save(room);
      await queryRunner.commitTransaction();

      // 🔽 DTO로 변환하여 반환
      return RoomDetailResponseDto.fromEntity(savedRoom);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw new InternalServerErrorException(
        `Room creation failed: ${error.message}`,
      );
    } finally {
      await queryRunner.release();
    }
  }

  // 방 참가
  async joinRoom(
    roomId: string,
    userId: number,
    password?: string,
  ): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const room = await queryRunner.manager.findOne(Room, {
        where: { id: roomId },
        relations: ['participants'],
      });

      if (!room) throw new NotFoundException('방을 찾을 수 없습니다.');

      await this.validatePassword(room, password);
      await this.checkParticipantLimit(room);
      const user = await this.findUser(userId);
      await this.addParticipant(queryRunner, room, user);

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // 비밀번호 검증
  private async validatePassword(room: Room, password?: string): Promise<void> {
    if (!room.password) return;
    if (!password) {
      throw new BadRequestException('비밀번호를 입력해주세요.');
    }

    const isValid = await compare(password, room.password);
    if (!isValid) {
      const key = `${room.id}`;
      const attempts = this.failedLoginAttempts.get(key) || {
        count: 0,
        timestamp: Date.now(),
      };
      attempts.count += 1;
      this.failedLoginAttempts.set(key, attempts);

      if (
        attempts.count >=
        this.configService.get<number>('MAX_LOGIN_ATTEMPTS', 5)
      ) {
        throw new BadRequestException(
          '너무 많은 시도로 인해 잠시 후 다시 시도해주세요.',
        );
      }
      throw new BadRequestException('비밀번호가 일치하지 않습니다.');
    } else {
      const key = `${room.id}:${password}`;
      this.failedLoginAttempts.delete(key);
    }
  }

  // 방 인원수 제한 확인
  private async checkParticipantLimit(room: Room): Promise<void> {
    if (room.participants.length >= room.maxParticipants) {
      throw new BadRequestException('방이 꽉 찼습니다.');
    }
  }

  // 유저 확인
  private async findUser(userId: number): Promise<User> {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) throw new NotFoundException('사용자를 찾을 수 없습니다.');
    return user;
  }

  // 참가자 추가
  private async addParticipant(
    queryRunner: QueryRunner,
    room: Room,
    user: User,
  ): Promise<void> {
    if (!room.participants.some((p) => p.id === user.id)) {
      room.participants.push(user);
      await queryRunner.manager.save(room);
    }
  }

  // 방 검색
  // 🔁 검색 결과를 DTO 배열로 반환
  async searchRooms(
    query: string,
    language: string = 'ko_kr',
  ): Promise<RoomDetailResponseDto[]> {
    const qb = this.roomRepository.createQueryBuilder('room');

    if (query) {
      const sanitizedQuery = query.replace(/['\\]/g, '\\$&');
      const tsQuery = sanitizedQuery.replace(/\s+/g, ' & ');

      qb.where(`room.searchVector @@ to_tsquery(:language, :query)`, {
        language,
        query: tsQuery,
      });
    }

    // 🔽 관련 엔티티 로드 (DTO 변환에 필요)
    qb.leftJoinAndSelect('room.creator', 'creator').leftJoinAndSelect(
      'room.participants',
      'participants',
    );

    const rooms = await qb.getMany();
    return rooms.map(RoomDetailResponseDto.fromEntity);
  }

  // 🔁 방 상세 정보 조회 (RoomDetailResponseDto 반환)
  async getRoomById(id: string): Promise<RoomDetailResponseDto> {
    const room = await this.roomRepository.findOne({
      where: { id },
      relations: ['creator', 'participants'],
    });

    if (!room) {
      throw new NotFoundException(`방 ID "${id}"를 찾을 수 없습니다.`);
    }

    // 🔽 Room 엔티티를 DTO로 변환하여 반환
    return RoomDetailResponseDto.fromEntity(room);
  }
}
