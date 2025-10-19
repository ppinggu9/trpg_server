// src/vtt/vtt.gateway.ts
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
import { VttService } from './vtt.service';
import { MoveTokenDto } from '@/token/dto/move-token.dto';
import { jwtValidatedOutputDto } from '@/auth/types/jwt-payload.dto';
import { WsAuthMiddleware } from '@/auth/ws-auth.middleware';
import {
  TOKEN_ERROR_MESSAGES,
  TokenErrorCode,
} from '@/token/constants/token.constants';
import { OnEvent } from '@nestjs/event-emitter';
import { MapUpdatedEvent } from './event/map-updated.event';
import { UpdateMapMessage } from './types/update-map-message.interface';

@WebSocketGateway(11123, {
  namespace: '/vtt',
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class VttGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // mapId(string) → Set<userId>
  private readonly connectedUsers = new Map<string, Set<number>>();

  constructor(
    private readonly vttService: VttService,
    private readonly wsAuthMiddleware: WsAuthMiddleware,
  ) {}

  afterInit(server: Server) {
    server.use(this.wsAuthMiddleware.createMiddleware());
  }

  handleConnection(client: Socket) {
    const user = client.data.user as jwtValidatedOutputDto;
    console.log(`✅ VTT client connected: ${client.id}, User: ${user.email}`);
  }

  handleDisconnect(client: Socket) {
    const user = client.data.user as jwtValidatedOutputDto;
    console.log(`VTT client disconnected: ${client.id}`);

    // 모든 맵에서 사용자 제거
    for (const [mapId, userSet] of this.connectedUsers.entries()) {
      userSet.delete(user.id);
      if (userSet.size === 0) {
        this.connectedUsers.delete(mapId);
      }
    }
  }

  @OnEvent('map.updated')
  handleMapUpdated(event: MapUpdatedEvent) {
    this.server.to(`map-${event.mapId}`).emit('mapUpdated', {
      mapId: event.mapId,
      ...event.payload,
    });
  }

  @SubscribeMessage('joinMap')
  async handleJoinMap(
    @MessageBody() data: { mapId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const user = client.data.user as jwtValidatedOutputDto;
    const { mapId } = data;

    try {
      // 1. 접근 권한 체크 (방 참여 + 맵 존재)
      await this.vttService.validateMapAccess(mapId, user.id);

      // 2. 상태 등록
      if (!this.connectedUsers.has(mapId)) {
        this.connectedUsers.set(mapId, new Set());
      }
      this.connectedUsers.get(mapId)!.add(user.id);

      // 3. Socket.IO 방 참여
      client.join(`map-${mapId}`);
      client.emit('joinedMap', { mapId });
    } catch (error) {
      client.emit('error', { message: error.message });
    }
  }

  @SubscribeMessage('leaveMap')
  async handleLeaveMap(
    @MessageBody() data: { mapId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const user = client.data.user as jwtValidatedOutputDto;
    const { mapId } = data;

    const userSet = this.connectedUsers.get(mapId);
    if (userSet) {
      userSet.delete(user.id);
      if (userSet.size === 0) {
        this.connectedUsers.delete(mapId);
      }
    }

    client.leave(`map-${mapId}`);
    client.emit('leftMap', { mapId });
  }

  @SubscribeMessage('moveToken')
  async handleMoveToken(
    @MessageBody() dto: MoveTokenDto,
    @ConnectedSocket() client: Socket,
  ) {
    const user = client.data.user as jwtValidatedOutputDto;
    const { tokenId, x, y } = dto;

    try {
      // 1. 권한 체크 (토큰 존재 + 이동 권한)
      const token = await this.vttService.validateTokenMoveAccess(
        tokenId,
        user.id,
      );

      // 2. 현재 맵에 접속 중인지 확인
      const isCurrentlyInMap = this.connectedUsers
        .get(token.mapId)
        ?.has(user.id);
      if (!isCurrentlyInMap) {
        client.emit('error', {
          message: TOKEN_ERROR_MESSAGES[TokenErrorCode.NOT_IN_ROOM],
        });
        return;
      }

      // 3. userId를 명시적으로 전달
      await this.vttService.moveToken(tokenId, { x, y }, user.id);

      // 4. 브로드캐스트
      this.server
        .to(`map-${token.mapId}`)
        .emit('tokenMoved', { tokenId, x, y });
    } catch (error) {
      client.emit('error', { message: error.message });
    }
  }

  @SubscribeMessage('updateMap')
  async handleUpdateMap(
    @MessageBody() raw: any, // plain object
    @ConnectedSocket() client: Socket,
  ) {
    const user = client.data.user as jwtValidatedOutputDto;

    try {
      // 1. 수동 유효성 검사
      if (!raw || typeof raw.mapId !== 'string') {
        throw new Error('Invalid mapId');
      }
      if (!raw.updates || typeof raw.updates !== 'object') {
        throw new Error('Invalid updates');
      }

      const { mapId, updates } = raw as UpdateMapMessage;

      // // 2. 도메인 레벨 검증 (선택 사항)
      // validateMapId(mapId);
      // validateMapUpdates(updates); // 예: gridSize 10~200, gridType enum 등

      // 3. 서비스 호출
      await this.vttService.updateMap(mapId, updates, user.id);
    } catch (error) {
      console.error('[GW] updateMap error:', error);
      client.emit('error', {
        message: error.message || 'Invalid updateMap payload',
      });
    }
  }
}
