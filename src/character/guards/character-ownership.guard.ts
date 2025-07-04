import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { CharacterService } from '../character.service';

@Injectable()
export class CharacterOwnershipGuard implements CanActivate {
  constructor(private readonly characterService: CharacterService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const id = parseInt(request.params.id, 10);
    const userId = request.user.userId;

    // ✅ 공개 메서드로 소유권 검증
    await this.characterService.verifyCharacterOwnership(id, userId);
    return true;
  }
}