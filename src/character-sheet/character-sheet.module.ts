import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CharacterSheet } from './entities/character-sheet.entity';
import { CharacterSheetService } from './character-sheet.service';
import { CharacterSheetController } from './character-sheet.controller';
import { RoomModule } from '@/room/room.module';
import { CharacterSheetValidatorService } from './character-sheet-validator.service';
import { S3Module } from '@/s3/s3.module';

@Module({
  imports: [TypeOrmModule.forFeature([CharacterSheet]), RoomModule, S3Module],
  providers: [CharacterSheetService, CharacterSheetValidatorService],
  controllers: [CharacterSheetController],
  exports: [CharacterSheetService],
})
export class CharacterSheetModule {}
