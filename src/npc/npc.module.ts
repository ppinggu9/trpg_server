import { Module } from '@nestjs/common';
import { NpcService } from './npc.service';
import { NpcController } from './npc.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Npc } from './entities/npc.entity';
import { NpcValidatorService } from './npc-validator.service';
import { RoomModule } from '@/room/room.module';

@Module({
  imports: [TypeOrmModule.forFeature([Npc]), RoomModule],
  controllers: [NpcController],
  providers: [NpcService, NpcValidatorService],
  exports: [NpcService],
})
export class NpcModule {}
