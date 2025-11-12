import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { CreateChatMessagesDto } from './dto/create-chat-messages.dto';
import { MessageResponseDto } from './dto/message-response.dto';
import { jwtValidatedOutputDto } from '@/auth/types/jwt-payload.dto';
import { WsAuthMiddleware } from '@/auth/ws-auth.middleware';
import { CHAT_ERRORS } from './constant/chat.constant';
import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly connectedUsers = new Map<number, Set<number>>();

  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
    private readonly chatService: ChatService,
    private readonly wsAuthMiddleware: WsAuthMiddleware,
  ) {}

  afterInit(server: Server) {
    server.use(this.wsAuthMiddleware.createMiddleware());
  }

  handleConnection(client: Socket) {
    const user = client.data.user as jwtValidatedOutputDto;
    console.log(
      `✅ Authenticated client connected: ${client.id}, User: ${user.email}`,
    );
  }

  handleDisconnect(client: Socket) {
    const user = client.data.user as jwtValidatedOutputDto;
    console.log(`Client disconnected: ${client.id}, User: ${user.email}`);

    for (const [roomId, userSet] of this.connectedUsers.entries()) {
      userSet.delete(user.id);
      if (userSet.size === 0) {
        this.connectedUsers.delete(roomId);
      }
    }
  }

  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @MessageBody() data: { roomId: number },
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const user = client.data.user as jwtValidatedOutputDto;
    const userId = user.id;
    const roomId = data.roomId;

    try {
      await this.chatService.checkUserCanAccessRoom(userId, roomId);

      if (!this.connectedUsers.has(roomId)) {
        this.connectedUsers.set(roomId, new Set());
      }
      this.connectedUsers.get(roomId)!.add(userId);

      client.join(`room-${roomId}`);
      client.emit('joinedRoom', { roomId });
      console.log(`User ${userId} joined room ${roomId}`);
    } catch (error) {
      client.emit('error', { message: 'Cannot join room: ' + error.message });
      return;
    }
  }

  @SubscribeMessage('leaveRoom')
  async handleLeaveRoom(
    @MessageBody() data: { roomId: number },
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const user = client.data.user as jwtValidatedOutputDto;
    const roomId = data.roomId;

    const userSet = this.connectedUsers.get(roomId);
    if (userSet) {
      userSet.delete(user.id);
      if (userSet.size === 0) {
        this.connectedUsers.delete(roomId);
      }
    }

    client.leave(`room-${roomId}`);
    client.emit('leftRoom', { roomId });
    console.log(`User ${user.id} left room ${roomId}`);
  }

  @SubscribeMessage('sendMessage')
  async handleMessage(
    @MessageBody() createMessagesDto: CreateChatMessagesDto,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    try {
      const user = client.data.user as jwtValidatedOutputDto;
      const userId = user.id;
      const roomId = createMessagesDto.roomId;

      await this.chatService.checkUserCanAccessRoom(userId, roomId);

      const isCurrentlyInRoom = this.connectedUsers.get(roomId)?.has(userId);
      if (!isCurrentlyInRoom) {
        client.emit('error', { message: CHAT_ERRORS.INVALID_PARTICIPANT });
        return;
      }

      const savedMessages: MessageResponseDto[] =
        await this.chatService.createMessages(userId, createMessagesDto);

      this.server
        .to(`room-${createMessagesDto.roomId}`)
        .emit('newMessage', savedMessages[0]);
    } catch (error) {
      client.emit('error', { message: error.message });
    }
  }
}
