import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatMessage } from './entities/chat-message.entity';
import { ChatParticipant } from './entities/chat-participant.entity';
import { ChatRoom } from './entities/chat-room.entity';
import { ChatController } from './chat.controller';
import { UsersModule } from '@/users/users.module';
import { ChatGateway } from './chat.gateway';
import { AuthModule } from '@/auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChatRoom, ChatParticipant, ChatMessage]),
    UsersModule,
    AuthModule,
  ],
  providers: [ChatService, ChatGateway],
  exports: [ChatService],
  controllers: [ChatController],
})
export class ChatModule {}
