import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Room } from './entities/room.entity';
import { RoomService } from './room.service';
import { UsersModule } from '@/users/users.module';
import { RoomController } from './room.controller';
import { RoomParticipant } from './entities/room-participant.entity';
import { RoomValidatorService } from './room-validator.service';
import { RoomParticipantService } from './room-participant.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Room, RoomParticipant]),
    forwardRef(() => UsersModule),
  ],
  controllers: [RoomController],
  providers: [RoomService, RoomValidatorService, RoomParticipantService],
  exports: [RoomService, RoomParticipantService],
})
export class RoomModule {}
