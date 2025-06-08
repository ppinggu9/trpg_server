import { Module, OnApplicationBootstrap } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createNestJSDatasource } from './data-source';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const options = createNestJSDatasource(configService);
        return {
          ...options,
          migrationsRun: false,
          logging: true,
        };
      },
    }),
  ],
})
export class DbModule implements OnApplicationBootstrap {
  constructor(private dataSource: DataSource) {}
  async onApplicationBootstrap() {}
}
