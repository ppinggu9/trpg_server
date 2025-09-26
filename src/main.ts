import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import {
  initializeTransactionalContext,
  StorageDriver,
} from 'typeorm-transactional';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { IoAdapter } from '@nestjs/platform-socket.io';

async function bootstrap() {
  initializeTransactionalContext({ storageDriver: StorageDriver.AUTO });
  const app = await NestFactory.create(AppModule);
  app.useWebSocketAdapter(new IoAdapter(app));

  const configService = app.get(ConfigService);
  if (configService.get<boolean>('DATABASE_MIGRATIONS_RUN')) {
    const dataSource = app.get(DataSource);
    await dataSource.runMigrations({ transaction: 'all' });
  }

  const port = configService.get<number>('HTTP_SERVER_POST', 3000);
  const frontEndOrigin = configService.get<string>(
    'FRONTEND_ORIGIN',
    'http://localhost:3000',
  );

  app.enableCors({
    origin: frontEndOrigin,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'Set-Cookie'],
    exposedHeaders: ['Set-Cookie'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Trpg_Sever-API')
    .setDescription('The Trpg_Sever-API description')
    .setVersion('1.0')
    .addTag('Trpg_Sever-API')
    .addBearerAuth()
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, documentFactory);

  await app.listen(port);
}
bootstrap();
