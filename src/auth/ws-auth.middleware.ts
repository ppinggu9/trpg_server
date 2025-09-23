// src/auth/ws-auth.middleware.ts
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Socket } from 'socket.io';
import { jwtValidatedOutputDto } from './types/jwt-payload.dto';
import { WsException } from '@nestjs/websockets';

// ✅ 핵심: Socket.IO 미들웨어 타입 정의
export type SocketMiddleware = (
  socket: Socket,
  next: (err?: Error) => void,
) => void;

@Injectable()
export class WsAuthMiddleware {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // ✅ 핵심: Socket.IO 미들웨어를 반환하는 팩토리 메서드
  createMiddleware(): SocketMiddleware {
    return async (socket: Socket, next: (err?: Error) => void) => {
      try {
        const authHeader = socket.handshake.headers.authorization;
        if (!authHeader) {
          throw new WsException('No token provided');
        }

        const token = authHeader.split(' ')[1];
        if (!token) {
          throw new WsException('Invalid token format');
        }

        const payload =
          await this.jwtService.verifyAsync<jwtValidatedOutputDto>(token, {
            secret: this.configService.get<string>('JWT_SECRET', 'mysecretkey'),
          });

        socket.data.user = payload;
        next(); // 인증 성공
      } catch (error) {
        next(new WsException('Authentication failed')); // 인증 실패
      }
    };
  }
}
