import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class CharacterOwnershipGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const character = request.character; // CharacterExistsGuard에서 설정
    const userId = request.user.userId;

    if (character.ownerId !== userId) {
      throw new ForbiddenException('해당 캐릭터에 접근할 권한이 없습니다.');
    }

    return true;
  }
}