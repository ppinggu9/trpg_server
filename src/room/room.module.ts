import { Module } from '@nestjs/common';
import { RoomService } from './room.service';
import { RoomController } from './room.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Room } from './entities/room.entity';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RoomJoiningService } from './room-joining.service';

@Module({
  imports: [TypeOrmModule.forFeature([Room]),
 CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        ttl: configService.get<number>('CACHE_TTL', 3600),
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [RoomService,  RoomJoiningService,],
  controllers: [RoomController],
  exports: [RoomService,  RoomJoiningService,],
})
export class RoomModule {}
