// src/chat/chat.service.ts

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatRoom } from './entities/chat-room.entity';
import { ChatParticipant } from './entities/chat-participant.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { CreateChatRoomDto } from './dto/create-chat-room.dto';
import { CreateChatMessagesDto } from './dto/create-chat-messages.dto';
import { ChatRoomResponseDto } from './dto/chat-room-response.dto';
import { MessageResponseDto } from './dto/message-response.dto';
import { UsersService } from '@/users/users.service';
import { Transactional } from 'typeorm-transactional';
import { CHAT_ERRORS } from './constant/chat.constant';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatRoom)
    private chatRoomRepository: Repository<ChatRoom>,
    @InjectRepository(ChatParticipant)
    private chatParticipantRepository: Repository<ChatParticipant>,
    @InjectRepository(ChatMessage)
    private chatMessageRepository: Repository<ChatMessage>,
    private usersService: UsersService,
  ) {}

  // 1. 채팅방 생성
  @Transactional()
  async createChatRoom(
    userId: number,
    createRoomDto: CreateChatRoomDto,
  ): Promise<ChatRoomResponseDto> {
    // 1. 채팅방 생성 및 저장
    const chatRoom = this.chatRoomRepository.create({
      name: createRoomDto.name,
      creator: { id: userId },
    });
    const savedRoom = await this.chatRoomRepository.save(chatRoom);

    // 2. 생성자 참여자 추가
    const creator = await this.usersService.getUserById(userId);
    if (!creator) {
      throw new InternalServerErrorException(CHAT_ERRORS.INTERNAL_SERVER_ERROR);
    }
    const creatorChatParticipant = this.chatParticipantRepository.create({
      user: creator,
      chatRoom: savedRoom,
    });
    await this.chatParticipantRepository.save(creatorChatParticipant);

    // 3. 다른 참여자들 추가
    const participantIds = [userId]; // 생성자는 항상 첫 번째 참여자
    for (const participantId of createRoomDto.participantIds) {
      if (participantId === userId) continue;
      const participant = await this.usersService.getUserById(participantId);
      if (!participant) {
        throw new BadRequestException(CHAT_ERRORS.NON_EXISTED_USER);
      }
      const chatParticipant = this.chatParticipantRepository.create({
        user: participant,
        chatRoom: savedRoom,
      });
      await this.chatParticipantRepository.save(chatParticipant);
      participantIds.push(participantId);
    }

    // 4. [핵심 변경] 저장된 방을 다시 DB에서 조회하여 정확한 값을 가져옴
    const roomWithFreshData = await this.chatRoomRepository.findOne({
      where: { id: savedRoom.id },
      relations: ['creator'], // creator 관계도 함께 로드
    });

    if (!roomWithFreshData) {
      // throw new InternalServerErrorException('Failed to retrieve created room');
      throw new InternalServerErrorException(CHAT_ERRORS.INTERNAL_SERVER_ERROR);
    }

    return ChatRoomResponseDto.fromEntity(roomWithFreshData, participantIds);
  }

  // 2. 메시지 배치 저장
  async createMessages(
    requesterUserId: number, // API를 호출한 사용자 (권한 검사용)
    createMessagesDto: CreateChatMessagesDto,
  ): Promise<MessageResponseDto[]> {
    // 1. 요청자가 해당 방의 참여자인지 확인 (기본적인 접근 권한)
    const requesterParticipant = await this.chatParticipantRepository.findOne({
      where: {
        user: { id: requesterUserId },
        chatRoom: { id: createMessagesDto.roomId },
      },
    });

    if (!requesterParticipant) {
      throw new ForbiddenException(CHAT_ERRORS.INVALID_PARTICIPANT);
    }

    // 2. 각 메시지의 senderId가 해당 방의 참여자인지 확인
    //    (요청자가 다른 사람의 메시지를 위조하지 못하도록)
    const validSenderIds = new Set<number>();
    for (const msgDto of createMessagesDto.messages) {
      const messageSenderParticipant =
        await this.chatParticipantRepository.findOne({
          where: {
            user: { id: msgDto.senderId },
            chatRoom: { id: createMessagesDto.roomId },
          },
        });

      if (!messageSenderParticipant) {
        throw new ForbiddenException(
          CHAT_ERRORS.NON_EXISTED_USER_WITH_ID(msgDto.senderId),
        );
      }
      validSenderIds.add(msgDto.senderId);
    }

    // 3. 메시지 객체들을 생성
    const messageEntities = createMessagesDto.messages.map((msgDto) =>
      this.chatMessageRepository.create({
        sender: { id: msgDto.senderId }, // DTO에서 받은 senderId 사용
        chatRoom: { id: createMessagesDto.roomId },
        content: msgDto.content,
        sentAt: new Date(msgDto.sentAt),
      }),
    );

    // 4. 데이터베이스에 일괄 저장
    const savedMessages =
      await this.chatMessageRepository.save(messageEntities);

    // 5. 응답 DTO로 변환
    return savedMessages.map((msg) => MessageResponseDto.fromEntity(msg));
  }

  // 3. 방의 최근 메시지 조회
  async getRecentMessages(
    userId: number,
    roomId: number,
    limit: number = 50, // 기본적으로 최근 50개 메시지
  ): Promise<MessageResponseDto[]> {
    // 1. 사용자가 해당 방의 참여자인지 확인
    const participant = await this.chatParticipantRepository.findOne({
      where: {
        user: { id: userId },
        chatRoom: { id: roomId },
      },
    });
    if (!participant) {
      throw new ForbiddenException(CHAT_ERRORS.INVALID_PARTICIPANT);
    }
    // 2. 최신순으로 메시지 조회
    const messages = await this.chatMessageRepository.find({
      where: { chatRoom: { id: roomId } },
      order: { sentAt: 'DESC' }, // 최신 메시지부터
      take: limit,
      relations: ['sender'], // <-- sender 관계를 명시적으로 로드
    });
    // 3. 오래된 순서로 정렬 (클라이언트가 위에서 아래로 읽기 편하도록)
    messages.reverse();
    return messages.map((msg) => MessageResponseDto.fromEntity(msg));
  }

  // 4. 채팅방 삭제
  @Transactional()
  async deleteChatRoom(userId: number, roomId: number): Promise<void> {
    // 1. 방 정보 조회
    const chatRoom = await this.chatRoomRepository.findOne({
      where: { id: roomId },
      relations: ['creator'],
    });

    if (!chatRoom) {
      throw new NotFoundException(CHAT_ERRORS.ROOM_NOT_FOUND);
    }

    // 2. 방장만 삭제 가능
    if (chatRoom.creator.id !== userId) {
      throw new ForbiddenException(CHAT_ERRORS.ONLY_CREATOR_CAN_DELETE);
    }

    // 3. 해당 방의 모든 참여자 조회
    const participants = await this.chatParticipantRepository.find({
      where: {
        chatRoom: { id: roomId },
      },
    });

    // 4. 모든 참여자의 leftAt을 현재 시간으로 설정 (소프트 삭제)
    for (const participant of participants) {
      await this.chatParticipantRepository.softDelete({ id: participant.id });
    }

    // 5. 채팅방 소프트 삭제
    await this.chatRoomRepository.softDelete({ id: roomId });
  }

  async inviteUser(
    inviterId: number,
    roomId: number,
    inviteeId: number,
  ): Promise<void> {
    // 1. 초대자(inviter)가 방장인지 확인
    const room = await this.chatRoomRepository.findOne({
      where: { id: roomId, creator: { id: inviterId } },
    });
    if (!room) {
      throw new ForbiddenException(CHAT_ERRORS.ONLY_CREATOR_CAN_INVITE);
    }

    // 2. 초대 대상자(invitee)가 이미 참여 중인지 확인
    const existingParticipant = await this.chatParticipantRepository.findOne({
      where: { user: { id: inviteeId }, chatRoom: { id: roomId } },
      withDeleted: true,
    });
    if (existingParticipant && existingParticipant.leftAt === null) {
      throw new BadRequestException(CHAT_ERRORS.USER_ALREADY_PARTICIPANT);
    }

    // 3. 이미 참여 기록이 있다면 leftAt을 null로 업데이트, 없다면 새로 생성
    if (existingParticipant) {
      existingParticipant.leftAt = null;
      await this.chatParticipantRepository.save(existingParticipant);
    } else {
      const user = await this.usersService.getUserById(inviteeId);
      if (!user) {
        throw new BadRequestException(CHAT_ERRORS.NON_EXISTED_USER);
      }
      const newParticipant = this.chatParticipantRepository.create({
        user: user,
        chatRoom: { id: roomId },
      });
      await this.chatParticipantRepository.save(newParticipant);
    }
  }

  // 사용자 퇴장 (자진 퇴장 또는 방장에 의한 강제 퇴장)
  async removeUser(
    requesterId: number,
    roomId: number,
    targetUserId: number,
  ): Promise<void> {
    // 1. 요청자가 방장이거나, 본인을 퇴장시키는 경우인지 확인
    const room = await this.chatRoomRepository.findOne({
      where: { id: roomId },
      relations: ['creator'],
    });

    if (!room) {
      throw new NotFoundException(CHAT_ERRORS.ROOM_NOT_FOUND);
    }

    const isRequesterCreator = room.creator.id === requesterId;
    const isSelfRemoval = requesterId === targetUserId;

    if (isRequesterCreator && isSelfRemoval) {
      throw new BadRequestException(CHAT_ERRORS.CREATOR_CANNOT_SELF_REMOVE);
    }

    if (!isRequesterCreator && !isSelfRemoval) {
      throw new ForbiddenException(CHAT_ERRORS.CANNOT_REMOVE_USER);
    }

    // 2. 대상 사용자의 참여 기록 조회
    const participant = await this.chatParticipantRepository.findOne({
      where: {
        user: { id: targetUserId },
        chatRoom: { id: roomId },
      },
    });

    if (!participant) {
      throw new BadRequestException(CHAT_ERRORS.USER_NOT_IN_ROOM);
    }

    await this.chatParticipantRepository.softDelete({
      user: { id: targetUserId },
      chatRoom: { id: roomId },
    });
  }
}
