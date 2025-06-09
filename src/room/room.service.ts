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
import { Logger } from '@nestjs/common';

// 🔽 DTO import 추가
import { RoomDetailResponseDto } from './dto/room-detail-response.dto';
import { RoomResponseDto } from './dto/room-response.dto';

@Injectable()
export class RoomService {
  private readonly logger = new Logger(RoomService.name);

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
  async createRoom(
    dto: CreateRoomDto,
    creatorId: number,
  ): Promise<RoomDetailResponseDto> {
    this.logger.log(`[CREATE_ROOM] 방 생성 요청: ${dto.name}`);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const creator = await this.userRepository.findOneBy({ id: creatorId });
      if (!creator) {
        this.logger.warn(`[CREATE_ROOM] 사용자를 찾을 수 없음: ${creatorId}`);
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

      this.logger.log(`[CREATE_ROOM] 방 생성 성공: ${savedRoom.id}`);
      return RoomDetailResponseDto.fromEntity(savedRoom);
    } catch (error) {
      this.logger.error(`[CREATE_ROOM] 방 생성 실패: ${error.message}`);
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
    this.logger.log(`[JOIN_ROOM] 방 참가 요청: ${roomId}, 사용자 ID: ${userId}`);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const room = await queryRunner.manager.findOne(Room, {
        where: { id: roomId },
        relations: ['participants'],
      });

      if (!room) {
        this.logger.warn(`[JOIN_ROOM] 방을 찾을 수 없음: ${roomId}`);
        throw new NotFoundException('방을 찾을 수 없습니다.');
      }

      await this.validatePassword(room, password);
      await this.checkParticipantLimit(room);
      const user = await this.findUser(userId);
      await this.addParticipant(queryRunner, room, user);

      this.logger.log(`[JOIN_ROOM] 방 참가 성공: ${roomId}, 사용자 ID: ${userId}`);
      await queryRunner.commitTransaction();
    } catch (error) {
      this.logger.error(`[JOIN_ROOM] 방 참가 실패: ${error.message}`);
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
      this.logger.warn(`[VALIDATE_PASSWORD] 비밀번호 미입력: ${room.id}`);
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

      this.logger.warn(`[VALIDATE_PASSWORD] 비밀번호 일치하지 않음: ${room.id}, 시도 횟수: ${attempts.count}`);

      if (
        attempts.count >=
        this.configService.get<number>('MAX_LOGIN_ATTEMPTS', 5)
      ) {
        this.logger.warn(`[VALIDATE_PASSWORD] 시도 횟수 초과: ${room.id}`);
        throw new BadRequestException(
          '너무 많은 시도로 인해 잠시 후 다시 시도해주세요.',
        );
      }
      throw new BadRequestException('비밀번호가 일치하지 않습니다.');
    } else {
      const key = `${room.id}:${password}`;
      this.failedLoginAttempts.delete(key);
      this.logger.log(`[VALIDATE_PASSWORD] 비밀번호 검증 성공: ${room.id}`);
    }
  }

  // 방 인원수 제한 확인
  private async checkParticipantLimit(room: Room): Promise<void> {
    if (room.participants.length >= room.maxParticipants) {
      this.logger.warn(`[CHECK_PARTICIPANT_LIMIT] 방이 꽉 참: ${room.id}`);
      throw new BadRequestException('방이 꽉 찼습니다.');
    }
  }

  // 유저 확인
  private async findUser(userId: number): Promise<User> {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) {
      this.logger.warn(`[FIND_USER] 사용자를 찾을 수 없음: ${userId}`);
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }
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
      this.logger.log(`[ADD_PARTICIPANT] 사용자 추가됨: ${user.id}, 방 ID: ${room.id}`);
    }
  }

  // 방 검색
  async searchRooms(
    query: string,
    language: string = 'ko_kr',
  ): Promise<RoomResponseDto[]> {
    this.logger.log(`[SEARCH_ROOMS] 검색 요청: ${query}`);
    const qb = this.roomRepository.createQueryBuilder('room');

    try {
      if (query) {
        const sanitizedQuery = query.replace(/['\\]/g, '\\$&');
        const tsQuery = sanitizedQuery.replace(/\s+/g, ' & ');

        qb.where(`room.searchVector @@ to_tsquery(:language, :query)`, {
          language,
          query: tsQuery,
        });
      }

      qb.leftJoinAndSelect('room.creator', 'creator').leftJoinAndSelect(
        'room.participants',
        'participants',
      );

      const rooms = await qb.getMany();
      this.logger.log(`[SEARCH_ROOMS] 검색 성공, 결과 수: ${rooms.length}`);
      return rooms.map(RoomResponseDto.fromEntity);
    } catch (error) {
      this.logger.error(`[SEARCH_ROOMS] 검색 실패: ${error.message}`);
      return [];
    }
  }

  // 방 상세 정보 조회
  async getRoomById(id: string): Promise<RoomDetailResponseDto> {
    this.logger.log(`[GET_ROOM_BY_ID] 방 상세 정보 요청: ${id}`);
    try {
      const room = await this.roomRepository.findOne({
        where: { id },
        relations: ['creator', 'participants'],
      });

      if (!room) {
        this.logger.warn(`[GET_ROOM_BY_ID] 방을 찾을 수 없음: ${id}`);
        throw new NotFoundException(`방 ID "${id}"를 찾을 수 없습니다.`);
      }

      this.logger.log(`[GET_ROOM_BY_ID] 방 정보 조회 성공: ${id}`);
      return RoomDetailResponseDto.fromEntity(room);
    } catch (error) {
      this.logger.error(`[GET_ROOM_BY_ID] 방 정보 조회 실패: ${error.message}`);
      throw error;
    }
  }
}