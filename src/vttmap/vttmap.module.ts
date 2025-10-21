import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VttMap } from './entities/vttmap.entity';
import { RoomModule } from '@/room/room.module';
import { S3Module } from '@/s3/s3.module';
import { VttMapValidatorService } from './vttmap-validator.service';
import { VttMapController } from './vttmap.controller';
import { VttMapService } from './vttmap.service';

@Module({
  imports: [TypeOrmModule.forFeature([VttMap]), RoomModule, S3Module],
  controllers: [VttMapController],
  providers: [VttMapService, VttMapValidatorService],
  exports: [VttMapService, VttMapValidatorService],
})
export class VttmapModule {}
