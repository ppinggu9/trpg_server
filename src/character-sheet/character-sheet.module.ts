import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CharacterSheet } from './entities/character-sheet.entity';
import { CharacterSheetService } from './character-sheet.service';
import { CharacterSheetController } from './character-sheet.controller';
import { RoomModule } from '@/room/room.module';
import { CharacterSheetValidatorService } from './character-sheet-validator.service';

@Module({
  imports: [TypeOrmModule.forFeature([CharacterSheet]), RoomModule],
  providers: [CharacterSheetService, CharacterSheetValidatorService],
  controllers: [CharacterSheetController],
  exports: [CharacterSheetService],
})
export class CharacterSheetModule {}
