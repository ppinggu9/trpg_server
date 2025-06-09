import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class RoomResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map(data => {
        const httpContext = context.switchToHttp();
        const request = httpContext.getRequest();
        const { method, url } = request;

        let message = 'Success';

        // 방 관련 메시지 처리
        if (method === 'POST' && url === '/room') {
          message = '방이 성공적으로 생성되었습니다.';
        } else if (method === 'POST' && url.includes('/join')) {
          message = '방에 성공적으로 참여했습니다.';
        } else if (method === 'GET' && url === '/room') {
          message = '방 목록 조회에 성공했습니다.';
        } else if (method === 'GET' && url.match(/\/room\/[^/]+/)) {
          message = '방 상세 정보 조회에 성공했습니다.';
        }

        return { message, data };
      }),
    );
  }
}