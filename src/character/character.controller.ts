import {
  Controller,
  Get,
  Param,
  UseGuards,
} from '@nestjs/common';
import { CharacterDetailResponseDto } from './dto/character-detail-response.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CharacterOwnershipGuard } from './guards/character-ownership.guard';
import { CharacterService } from './character.service';
import { CharacterExistsGuard } from './guards/charcter-exists.guard';

@Controller('characters')
  @UseGuards(
    JwtAuthGuard,               // 사용자 인증
    CharacterExistsGuard,       // 캐릭터 존재 여부 검증
    CharacterOwnershipGuard     // 소유권 검증
  )
export class CharacterController {
  constructor(private readonly characterService: CharacterService) {}

  // 🔍 캐릭터 조회 (JWT 인증 + 존재성 + 소유권 검증)
  @Get(':id')
  async findOne(
    @Param('id') id: number,
  ): Promise<CharacterDetailResponseDto> {
    return this.characterService.findOne(id);
  }
}