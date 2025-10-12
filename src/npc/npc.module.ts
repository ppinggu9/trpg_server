import { Module } from '@nestjs/common';
import { NpcService } from './npc.service';
import { NpcController } from './npc.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Npc } from './entities/npc.entity';
import { NpcValidatorService } from './npc-validator.service';
import { RoomModule } from '@/room/room.module';
import { S3Module } from '@/s3/s3.module';

@Module({
  imports: [TypeOrmModule.forFeature([Npc]), RoomModule, S3Module],
  controllers: [NpcController],
  providers: [NpcService, NpcValidatorService],
  exports: [NpcService],
})
export class NpcModule {}
