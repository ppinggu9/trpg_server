// utils/socket-helper.ts
import { io, Socket as ClientSocket } from 'socket.io-client';

export type TestSocket = ClientSocket & {
  waitForEvent: (event: string, timeoutMs?: number) => Promise<any>;
};

// 단일 인증 방식 (Socket.IO 공식 방식)
export function createTestSocket(
  url: string,
  token: string,
  options: { timeout?: number } = {},
): TestSocket {
  const { timeout = 5000 } = options;

  const socket = io(url, {
    auth: { token: `Bearer ${token}` },
    transports: ['websocket'],
    reconnection: false, // 테스트 안정성 확보
  }) as TestSocket;

  // 타임아웃이 있는 이벤트 대기 유틸
  socket.waitForEvent = (event: string, overrideTimeout?: number) => {
    return new Promise((resolve, reject) => {
      const effectiveTimeout = overrideTimeout ?? timeout;
      const timer = setTimeout(() => {
        socket.off(event);
        reject(
          new Error(`[${event}] event timeout after ${effectiveTimeout}ms`),
        );
      }, effectiveTimeout);

      socket.once(event, (data) => {
        clearTimeout(timer);
        resolve(data);
      });
    });
  };

  return socket;
}

export function waitForSocketEvent<T>(
  socket: TestSocket,
  event: string,
  timeoutMs = 5000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timeout waiting for event: ${event}`));
    }, timeoutMs);

    const handler = (data: T) => {
      clearTimeout(timeout);
      socket.off(event, handler);
      resolve(data);
    };

    socket.on(event, handler);
  });
}

// 연결 대기 유틸 (타임아웃 3초)
export const waitForConnection = async (
  socket: TestSocket,
  timeout = 3000,
): Promise<void> => {
  return Promise.race([
    new Promise<void>((resolve) => socket.once('connect', resolve)),
    new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error('Connection timeout')), timeout),
    ),
    new Promise<void>((_, reject) =>
      socket.once('connect_error', (err) => reject(err)),
    ),
  ]);
};
