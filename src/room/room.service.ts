import {
  Injectable,
  NotFoundException,
  Logger,
  ForbiddenException,
  ConflictException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { CreateRoomDto } from './dto/create-room.dto';
import { JoinRoomDto } from './dto/join-room.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room } from './entities/room.entity';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '@/users/users.service';
import { Transactional } from 'typeorm-transactional';
import { RoomResponseDto } from './dto/room-response.dto';
import { RoomParticipantService } from './room-participant.service';
import { RoomValidatorService } from './room-validator.service';
import { ParticipantRole } from '@/common/enums/participant-role.enum';
import { ROOM_ERRORS, ROOM_MESSAGES } from './constants/room.constants';

@Injectable()
export class RoomService {
  private readonly logger = new Logger(RoomService.name);

  constructor(
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
    private readonly roomValidator: RoomValidatorService,
    private readonly roomParticipantService: RoomParticipantService,
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
  ) {}

  // 방 생성
  @Transactional()
  async createRoom(
    dto: CreateRoomDto,
    creatorId: number,
  ): Promise<{ message: string; room: RoomResponseDto }> {
    this.logger.log(`[CREATE_ROOM] 방 생성 요청: ${dto.name}`);

    // 사용자 객체 미리 조회
    const user = await this.usersService.getActiveUserById(creatorId);

    // 검증 단계에서 사용자 정보 활용
    await this.roomValidator.validateRoomCreation(user.id);

    // 방 생성 로직
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const room = this.roomRepository.create({
      name: dto.name,
      password: hashedPassword,
      maxParticipants: dto.maxParticipants,
      creator: user,
    });

    const savedRoom = await this.roomRepository.save(room);
    await this.roomParticipantService.addParticipant(
      savedRoom,
      user,
      ParticipantRole.PLAYER,
    );

    const updatedRoom = await this.roomRepository.findOne({
      where: { id: savedRoom.id },
      relations: ['creator', 'participants', 'participants.user'],
    });

    return {
      message: ROOM_MESSAGES.CREATED,
      room: RoomResponseDto.fromEntity(updatedRoom),
    };
  }

  // 방 참가
  @Transactional()
  async joinRoom(
    roomId: string,
    userId: number,
    dto: JoinRoomDto,
  ): Promise<{ message: string; room: RoomResponseDto }> {
    this.logger.log(
      `[JOIN_ROOM] 방 ID: ${roomId}, 사용자 ID: ${userId} 참여 시도`,
    );

    // 1. 방이 존재하는지 확인 (삭제된 방도 포함)
    const room = await this.roomRepository.findOne({
      where: { id: roomId },
      withDeleted: true,
      relations: ['creator', 'participants', 'participants.user'],
    });

    if (!room) {
      throw new NotFoundException({
        message: ROOM_ERRORS.NOT_FOUND,
        details: { roomId },
      });
    }

    // 2. 방이 삭제된 상태인지 먼저 확인 (동시성 문제 처리)
    if (room.deletedAt) {
      throw new ConflictException({
        message: ROOM_ERRORS.ROOM_JOIN_CONFLICT,
      });
    }

    // 3. 검증 (이제 room은 활성화된 방임이 보장됨)
    await this.roomValidator.validateRoomJoin(room, userId, dto.password);

    // 참가 로직
    const user = await this.usersService.getActiveUserById(userId);
    await this.roomParticipantService.addParticipant(room, user);

    // 최신 상태의 방 반환
    const updatedRoom = await this.roomRepository.findOne({
      where: { id: roomId },
      relations: ['creator', 'participants', 'participants.user'],
    });

    if (!updatedRoom) {
      throw new ConflictException({
        message: ROOM_ERRORS.ROOM_JOIN_CONFLICT,
      });
    }

    return {
      message: ROOM_MESSAGES.JOINED,
      room: RoomResponseDto.fromEntity(updatedRoom),
    };
  }

  //방 나가기
  @Transactional()
  async leaveRoom(userId: number, roomId: string): Promise<void> {
    this.logger.log(`[LEAVE_ROOM] 사용자 ID: ${userId} 방 나가기 시도`);

    // 소프트 삭제된 방도 포함 조회
    const room = await this.roomRepository.findOne({
      where: { id: roomId },
      withDeleted: true,
      relations: ['creator'],
    });

    // 방이 없거나 이미 삭제된 경우 → 성공 처리 (멱등성 보장)
    if (!room || room.deletedAt) {
      return;
    }

    // 방장인 경우 → 방 나가기 금지(예외 발생)
    if (room.creator?.id === userId) {
      throw new ForbiddenException({
        message: ROOM_ERRORS.CANNOT_LEAVE_AS_CREATOR,
      });
    }

    // 일반 참여자 → 참여 기록 제거 (멱등성 보장)
    await this.roomParticipantService.leaveRoom(userId, roomId);
  }

  // 방 삭제
  @Transactional()
  async deleteRoom(roomId: string, userId: number): Promise<void> {
    const room = await this.roomRepository.findOne({
      where: { id: roomId },
      withDeleted: true,
      relations: ['creator'],
    });

    //  방이 없거나 이미 삭제된 경우 → 성공 처리
    if (!room || room.deletedAt) {
      return; //멱등성 보장 (204 No Content)
    }

    // 권한 검증 (방장 확인)
    this.roomValidator.validateRoomCreator(room, userId);
    await this.deleteRoomInternal(room);
  }

  // INTERNAL: 방 삭제 로직 (트랜잭션 내에서 호출되는 헬퍼)
  private async deleteRoomInternal(room: Room): Promise<void> {
    // 모든 참가자 한 번에 나가게 처리
    await this.roomParticipantService.leaveAllUsersFromRoom(room.id);

    // 방 소프트 삭제
    await this.roomRepository.softDelete(room.id);

    // 방 생성자 정보 초기화
    if (room.creator) {
      room.creator.createdRoom = null;
      await this.usersService.updateUser(room.creator);
    }
  }

  // 방장 위임
  @Transactional()
  async transferCreator(
    roomId: string,
    currentUserId: number,
    newCreatorId: number,
  ): Promise<{ message: string; room: RoomResponseDto }> {
    this.logger.log(
      `[TRANSFER_CREATOR] 방 ID: ${roomId}, 기존 방장: ${currentUserId}, 신임 방장: ${newCreatorId}`,
    );

    // 방 조회
    const room = await this.findActiveRoom(roomId);

    if (!room) {
      throw new NotFoundException({
        message: ROOM_ERRORS.NOT_FOUND,
        details: { roomId },
      });
    }

    // 통합 검증
    await this.roomValidator.validateRoomTransfer(
      room,
      currentUserId,
      newCreatorId,
    );

    const newCreator = await this.usersService.getActiveUserById(newCreatorId);
    const oldCreator = room.creator;

    // 기존 방장의 createdRoom 먼저 해제 (UNIQUE 충돌 방지)
    if (oldCreator) {
      oldCreator.createdRoom = null;
      await this.usersService.updateUser(oldCreator);
    }

    // 새 방장의 createdRoom 설정
    newCreator.createdRoom = room;
    await this.usersService.updateUser(newCreator);

    // 방의 creator 갱신
    room.creator = newCreator;
    await this.roomRepository.save(room);

    return {
      message: ROOM_MESSAGES.CREATOR_TRANSFERRED,
      room: RoomResponseDto.fromEntity(room),
    };
  }

  // 역할 변경 메서드
  @Transactional()
  async updateParticipantRole(
    roomId: string,
    currentUserId: number,
    targetUserId: number,
    newRole: ParticipantRole,
  ): Promise<{ message: string; room: RoomResponseDto }> {
    // 변경된 방 정보 다시 조회
    this.logger.log(
      `[UPDATE_ROLE] 방 ID: ${roomId}, 변경자 ID: ${currentUserId}, 대상 ID: ${targetUserId}, 새로운 역할: ${newRole}`,
    );

    // 방 조회
    const room = await this.roomRepository.findOne({
      where: { id: roomId },
      relations: ['creator', 'participants', 'participants.user'],
    });
    if (!room) {
      throw new NotFoundException({
        message: ROOM_ERRORS.NOT_FOUND,
        details: { roomId },
      });
    }

    // 통합 검증 (기존의 개별 검증 대신 전용 검증 메서드 호출)
    await this.roomValidator.validateRoleChange(
      room,
      currentUserId,
      targetUserId,
      newRole,
    );

    // 대상 참여자 찾기 (validateRoleChange에서 이미 검증했으므로 단순 조회)
    const targetParticipant = room.participants.find(
      (p) => p.user.id === targetUserId,
    );

    // 역할 업데이트
    await this.roomParticipantService.updateParticipantRole(
      targetParticipant.id,
      newRole,
    );

    const updatedRoom = await this.roomRepository.findOne({
      where: { id: roomId },
      relations: ['creator', 'participants', 'participants.user'],
    });
    if (!updatedRoom) {
      throw new NotFoundException({
        message: ROOM_ERRORS.NOT_FOUND,
        details: { roomId },
      });
    }
    return {
      message: ROOM_MESSAGES.ROLE_UPDATED,
      room: RoomResponseDto.fromEntity(updatedRoom),
    };
  }

  // 방 참가자 목록 조회
  async getRoomWithParticipants(roomId: string): Promise<RoomResponseDto> {
    // 단일 쿼리로 방 정보와 참여자 정보 모두 조회
    const room = await this.roomRepository
      .createQueryBuilder('room')
      .where('room.id = :roomId', { roomId })
      .leftJoinAndSelect('room.participants', 'participants')
      .leftJoinAndSelect('participants.user', 'user')
      .leftJoinAndSelect('room.creator', 'creator')
      .getOne();

    if (!room) {
      throw new NotFoundException({
        message: ROOM_ERRORS.NOT_FOUND,
        details: { roomId },
      });
    }

    return RoomResponseDto.fromEntity(room);
  }

  // 보조 메서드: 비즈니스 로직이 아닌 단순 생성/조회
  private async findActiveRoom(roomId: string): Promise<Room> {
    const room = await this.roomRepository
      .createQueryBuilder('room')
      .addSelect('room.password')
      .where('room.id = :roomId', { roomId })
      .leftJoinAndSelect('room.participants', 'participants')
      .leftJoinAndSelect('participants.user', 'user')
      .leftJoinAndSelect('room.creator', 'creator')
      .andWhere('room.deletedAt IS NULL')
      .getOne();

    if (!room) {
      throw new NotFoundException({
        message: '방을 찾을 수 없습니다.',
        errorCode: 'ROOM_NOT_FOUND',
        details: { roomId },
      });
    }
    return room;
  }
}
