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
import { TokenCreatedEvent } from '@/token/events/token-created.event';
import { TokenUpdatedEvent } from '@/token/events/token-updated.event';
import { TokenDeletedEvent } from '@/token/events/token-deleted.event';
import { MapCreatedEvent } from './event/map-created.event';
import { MapDeletedEvent } from './event/map-deleted.event';

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
  private readonly connectedRooms = new Map<string, Set<number>>();
  private readonly connectedMaps = new Map<string, Set<number>>();

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

    // connectedMaps에서 사용자 제거
    for (const [mapId, userSet] of this.connectedMaps.entries()) {
      userSet.delete(user.id);
      if (userSet.size === 0) {
        this.connectedMaps.delete(mapId);
      }
    }

    // connectedRooms에서 사용자 제거
    for (const [roomId, userSet] of this.connectedRooms.entries()) {
      userSet.delete(user.id);
      if (userSet.size === 0) {
        this.connectedRooms.delete(roomId);
      }
    }
  }

  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const user = client.data.user as jwtValidatedOutputDto;
    const userId = user.id;
    const roomId = data.roomId;
    console.log(`[DEBUG] joinRoom called: roomId=${roomId}, userId=${userId}`);

    try {
      await this.vttService.validateParticipantAccess(roomId, userId);

      // 상태 등록
      if (!this.connectedRooms.has(roomId)) {
        this.connectedRooms.set(roomId, new Set());
      }
      this.connectedRooms.get(roomId)!.add(userId);

      client.join(`room-${roomId}`);
      client.emit('joinedRoom', { roomId });
      console.log(`[DEBUG] User ${userId} successfully joined room ${roomId}`);
    } catch (error) {
      console.error(
        `[ERROR] joinRoom failed for user ${userId}:`,
        error.message,
      );
      client.emit('error', { message: 'Cannot join room: ' + error.message });
      return;
    }
  }

  @SubscribeMessage('leaveRoom')
  async handleLeaveRoom(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const user = client.data.user as jwtValidatedOutputDto;
    const userId = user.id;
    const roomId = data.roomId;

    const userSet = this.connectedRooms.get(roomId);
    if (userSet) {
      userSet.delete(userId);
      if (userSet.size === 0) {
        this.connectedRooms.delete(roomId);
      }
    }
    client.leave(`room-${roomId}`);
    client.emit('leftRoom', { roomId });
  }

  @SubscribeMessage('joinMap')
  async handleJoinMap(
    @MessageBody() data: { mapId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const user = client.data.user as jwtValidatedOutputDto;
    const userId = user.id;
    const { mapId } = data;
    console.log(`[DEBUG] joinMap called: mapId=${mapId}, userId=${userId}`);
    try {
      // 맵 정보 조회 + 권한 검증 (roomId 포함)
      const map = await this.vttService.getVttMapForUser(mapId, userId);
      const isJoinedRoom = this.connectedRooms.get(map.roomId)?.has(userId);
      console.log(
        `[DEBUG] isJoinedRoom check: roomId=${map.roomId}, result=${isJoinedRoom}`,
      );
      if (!isJoinedRoom) {
        console.warn(
          `[WARN] User ${userId} not in room ${map.roomId}, cannot join map`,
        );
        client.emit('error', { message: '먼저 방에 입장하세요.' });
        return;
      }

      // 상태 등록
      if (!this.connectedMaps.has(mapId)) {
        this.connectedMaps.set(mapId, new Set());
      }
      this.connectedMaps.get(mapId)!.add(userId);

      // Socket.IO 방 참여
      client.join(`room-${map.roomId}`); // 맵 생성/삭제 수신용
      client.join(`map-${mapId}`); // 토큰/맵 설정 수신용

      // 전체 초기 상태: 맵 + 모든 토큰
      const tokens = await this.vttService.getTokensByMap(mapId, userId);

      client.emit('joinedMap', {
        mapId,
        map: {
          id: map.id,
          name: map.name ?? undefined,
          imageUrl: map.imageUrl ?? undefined,
          gridType: map.gridType,
          gridSize: map.gridSize,
          showGrid: map.showGrid,
          updatedAt: map.updatedAt,
        },
        tokens, // 전체 토큰 목록 포함
      });

      console.log(
        `✅ User ${userId} joined map ${mapId} with ${tokens.length} tokens`,
      );
    } catch (error) {
      console.error('[joinMap] Error:', error);
      client.emit('error', { message: error.message || '맵 참가 실패' });
    }
  }

  @OnEvent('map.created')
  handleMapCreated(event: MapCreatedEvent) {
    this.server.to(`room-${event.roomId}`).emit('mapCreated', event.map);
  }

  @OnEvent('map.updated')
  handleMapUpdated(event: MapUpdatedEvent) {
    this.server.to(`map-${event.mapId}`).emit('mapUpdated', {
      mapId: event.mapId,
      ...event.payload,
    });
  }

  @OnEvent('map.deleted')
  handleMapDeleted(event: MapDeletedEvent) {
    this.server.to(`room-${event.roomId}`).emit('mapDeleted', {
      id: event.mapId,
    });
  }

  @SubscribeMessage('leaveMap')
  async handleLeaveMap(
    @MessageBody() data: { mapId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const user = client.data.user as jwtValidatedOutputDto;
    const userId = user.id;
    const { mapId } = data;

    const userSet = this.connectedMaps.get(mapId);
    if (userSet) {
      userSet.delete(userId);
      if (userSet.size === 0) {
        this.connectedMaps.delete(mapId);
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
    const userId = user.id;
    const { tokenId, x, y } = dto;

    try {
      // 1. 권한 체크 (토큰 존재 + 이동 권한)
      const token = await this.vttService.validateTokenMoveAccess(
        tokenId,
        userId,
      );

      // 2. 현재 맵에 접속 중인지 확인
      const isCurrentlyInMap = this.connectedMaps.get(token.mapId)?.has(userId);
      if (!isCurrentlyInMap) {
        client.emit('error', {
          message: TOKEN_ERROR_MESSAGES[TokenErrorCode.NOT_IN_ROOM],
        });
        return;
      }

      // 3. userId를 명시적으로 전달
      await this.vttService.moveToken(tokenId, { x, y }, userId);
    } catch (error) {
      client.emit('error', { message: error.message });
    }
  }

  @OnEvent('token.created')
  handleTokenCreated(event: TokenCreatedEvent) {
    console.log('[GW] Emitting token:created to room map-', event.mapId);
    this.server.to(`map-${event.mapId}`).emit('token:created', event.token);
  }

  @OnEvent('token.updated')
  handleTokenUpdated(event: TokenUpdatedEvent) {
    this.server.to(`map-${event.mapId}`).emit('token:updated', event.token);
  }

  @OnEvent('token.deleted')
  handleTokenDeleted(event: TokenDeletedEvent) {
    this.server
      .to(`map-${event.mapId}`)
      .emit('token:deleted', { id: event.tokenId });
  }

  @SubscribeMessage('updateMap')
  async handleUpdateMap(
    @MessageBody() raw: any, // plain object
    @ConnectedSocket() client: Socket,
  ) {
    const user = client.data.user as jwtValidatedOutputDto;
    const userId = user.id;

    try {
      // 1. 수동 유효성 검사
      if (!raw || typeof raw.mapId !== 'string') {
        throw new Error('Invalid mapId');
      }
      if (!raw.updates || typeof raw.updates !== 'object') {
        throw new Error('Invalid updates');
      }

      const { mapId, updates } = raw as UpdateMapMessage;

      // 3. 서비스 호출
      await this.vttService.updateMap(mapId, updates, userId);
    } catch (error) {
      console.error('[GW] updateMap error:', error);
      client.emit('error', {
        message: error.message || 'Invalid updateMap payload',
      });
    }
  }
}
