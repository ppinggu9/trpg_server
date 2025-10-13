import * as Joi from 'joi';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { DbModule } from './db/db.module';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { RoomModule } from './room/room.module';
import { ChatModule } from './chat/chat.module';
import { CharacterSheetModule } from './character-sheet/character-sheet.module';
import { NpcModule } from './npc/npc.module';
import { HttpModule } from '@nestjs/axios';
import { S3Module } from './s3/s3.module';
import { VttmapModule } from './vttmap/vttmap.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV}`,
      validationSchema: Joi.object({
        DATABASE_HOST: Joi.string().required(),
        DATABASE_PORT: Joi.number().required(),
        DATABASE_USER: Joi.string().required(),
        DATABASE_PASSWORD: Joi.string().required(),
        DATABASE_DBNAME: Joi.string().required(),
        DATABASE_SYNCHRONIZE: Joi.boolean().required(),
        DATABASE_DROP_SCHEMA: Joi.boolean().required(),
        DATABASE_LOGGING: Joi.boolean().required(),
        DATABASE_MIGRATIONS_RUN: Joi.boolean().required(),
        FRONTEND_ORIGIN: Joi.string()
          .empty('')
          .uri()
          .optional()
          .default('http://localhost:3000')
          .description('Frontend origin for CORS'),
        AWS_REGION: Joi.string().required(),
        AWS_ACCESS_KEY_ID: Joi.string().optional(),
        AWS_SECRET_ACCESS_KEY: Joi.string().optional(),
        S3_BUCKET_NAME: Joi.string().required(),
        CLOUDFRONT_DOMAIN: Joi.string().required(),
      }),
    }),
    UsersModule,
    DbModule,
    AuthModule,
    RoomModule,
    ChatModule,
    CharacterSheetModule,
    NpcModule,
    HttpModule,
    S3Module,
    VttmapModule,
    // TokenModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
