import { Injectable, CanActivate, ExecutionContext, NotFoundException } from '@nestjs/common';
import { CharacterService } from '../character.service';


@Injectable()
export class CharacterExistsGuard implements CanActivate {
  constructor(private readonly characterService: CharacterService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const id = request.params.id;

    const character = await this.characterService.findOne(id);
    if (!character) {
      throw new NotFoundException(`캐릭터 ID ${id}를 찾을 수 없습니다.`);
    }

    // 요청 객체에 캐릭터 저장 (다른 가드나 라우트에서 재사용 가능)
    request.character = character;
    return true;
  }
}