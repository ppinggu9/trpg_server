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

  @Transactional()
  async createChatRoom(
    userId: number,
    createRoomDto: CreateChatRoomDto,
  ): Promise<ChatRoomResponseDto> {
    const chatRoom = this.chatRoomRepository.create({
      name: createRoomDto.name,
      creator: { id: userId },
    });
    const savedRoom = await this.chatRoomRepository.save(chatRoom);

    const creator = await this.usersService.getUserById(userId);
    if (!creator) {
      throw new InternalServerErrorException(CHAT_ERRORS.INTERNAL_SERVER_ERROR);
    }
    const creatorChatParticipant = this.chatParticipantRepository.create({
      user: creator,
      chatRoom: savedRoom,
    });
    await this.chatParticipantRepository.save(creatorChatParticipant);

    const participantIds = [userId];
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

    const roomWithFreshData = await this.chatRoomRepository.findOne({
      where: { id: savedRoom.id },
      relations: ['creator'],
    });

    if (!roomWithFreshData) {
      throw new InternalServerErrorException(CHAT_ERRORS.INTERNAL_SERVER_ERROR);
    }

    return ChatRoomResponseDto.fromEntity(roomWithFreshData, participantIds);
  }

  async createMessages(
    requesterUserId: number,
    createMessagesDto: CreateChatMessagesDto,
  ): Promise<MessageResponseDto[]> {
    const requesterParticipant = await this.chatParticipantRepository.findOne({
      where: {
        user: { id: requesterUserId },
        chatRoom: { id: createMessagesDto.roomId },
      },
    });

    if (!requesterParticipant) {
      throw new ForbiddenException(CHAT_ERRORS.INVALID_PARTICIPANT);
    }

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

    const messageEntities = createMessagesDto.messages.map((msgDto) =>
      this.chatMessageRepository.create({
        sender: { id: msgDto.senderId },
        chatRoom: { id: createMessagesDto.roomId },
        content: msgDto.content,
        sentAt: new Date(msgDto.sentAt),
      }),
    );

    const savedMessages =
      await this.chatMessageRepository.save(messageEntities);

    return savedMessages.map((msg) => MessageResponseDto.fromEntity(msg));
  }

  async getRecentMessages(
    userId: number,
    roomId: number,
    limit: number = 50,
  ): Promise<MessageResponseDto[]> {
    const participant = await this.chatParticipantRepository.findOne({
      where: {
        user: { id: userId },
        chatRoom: { id: roomId },
      },
    });
    if (!participant) {
      throw new ForbiddenException(CHAT_ERRORS.INVALID_PARTICIPANT);
    }

    const messages = await this.chatMessageRepository.find({
      where: { chatRoom: { id: roomId } },
      order: { sentAt: 'DESC' },
      take: limit,
      relations: ['sender'],
    });
    messages.reverse();
    return messages.map((msg) => MessageResponseDto.fromEntity(msg));
  }

  @Transactional()
  async deleteChatRoom(userId: number, roomId: number): Promise<void> {
    const chatRoom = await this.chatRoomRepository.findOne({
      where: { id: roomId },
      relations: ['creator'],
    });

    if (!chatRoom) {
      throw new NotFoundException(CHAT_ERRORS.ROOM_NOT_FOUND);
    }

    if (chatRoom.creator.id !== userId) {
      throw new ForbiddenException(CHAT_ERRORS.ONLY_CREATOR_CAN_DELETE);
    }

    const participants = await this.chatParticipantRepository.find({
      where: {
        chatRoom: { id: roomId },
      },
    });

    for (const participant of participants) {
      await this.chatParticipantRepository.softDelete({ id: participant.id });
    }

    await this.chatRoomRepository.softDelete({ id: roomId });
  }

  async inviteUser(
    inviterId: number,
    roomId: number,
    inviteeId: number,
  ): Promise<void> {
    const room = await this.chatRoomRepository.findOne({
      where: { id: roomId, creator: { id: inviterId } },
    });
    if (!room) {
      throw new ForbiddenException(CHAT_ERRORS.ONLY_CREATOR_CAN_INVITE);
    }

    const existingParticipant = await this.chatParticipantRepository.findOne({
      where: { user: { id: inviteeId }, chatRoom: { id: roomId } },
      withDeleted: true,
    });
    if (existingParticipant && existingParticipant.leftAt === null) {
      throw new BadRequestException(CHAT_ERRORS.USER_ALREADY_PARTICIPANT);
    }

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

  async removeUser(
    requesterId: number,
    roomId: number,
    targetUserId: number,
  ): Promise<void> {
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

  async isUserParticipant(userId: number, roomId: number): Promise<boolean> {
    const participant = await this.chatParticipantRepository.findOne({
      where: {
        user: { id: userId },
        chatRoom: { id: roomId },
      },
    });
    return !!participant;
  }

  async checkUserCanAccessRoom(userId: number, roomId: number): Promise<void> {
    const canAccess = await this.isUserParticipant(userId, roomId);
    if (!canAccess) {
      throw new ForbiddenException(CHAT_ERRORS.INVALID_PARTICIPANT);
    }
  }
}
