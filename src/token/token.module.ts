import { Module } from '@nestjs/common';
import { TokenService } from './token.service';
import { TokenController } from './token.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Token } from './entities/token.entity';
import { RoomModule } from '@/room/room.module';
import { VttmapModule } from '@/vttmap/vttmap.module';
import { CharacterSheetModule } from '@/character-sheet/character-sheet.module';
import { TokenValidatorService } from './token-validator.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Token]),
    RoomModule,
    VttmapModule,
    CharacterSheetModule,
  ],
  controllers: [TokenController],
  providers: [TokenService, TokenValidatorService],
  exports: [TokenService, TokenValidatorService],
})
export class TokenModule {}
