import { Injectable, CanActivate, ExecutionContext, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CharacterService } from '../character.service';


@Injectable()
export class CharacterExistsGuard implements CanActivate {
  constructor(private readonly characterService: CharacterService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const id = parseInt(request.params.id, 10);

    // ✅ 공개 메서드로 캐릭터 조회
    const character = await this.characterService.getCharacterById(id);
    request.character = character; // 요청 객체에 저장
    return true;
  }
}