import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DATABASE_CONFIG } from '../config/database.config';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: DATABASE_CONFIG.TYPE,
      host: DATABASE_CONFIG.HOST,
      port: DATABASE_CONFIG.PORT,
      username: DATABASE_CONFIG.USERNAME,
      password: DATABASE_CONFIG.PASSWORD,
      database: DATABASE_CONFIG.DATABASE,
      synchronize: DATABASE_CONFIG.SYNCHRONIZE,
      logging: DATABASE_CONFIG.LOGGING,
      autoLoadEntities: DATABASE_CONFIG.AUTO_LOAD_ENTITIES,
      ssl: DATABASE_CONFIG.SSL,
      entities: ['dist/**/*.entity{.ts,.js}'],
      migrations: ['dist/migrations/**/*{.ts,.js}'],
      subscribers: ['dist/subscribers/**/*{.ts,.js}'],
    }),
  ],
})
export class DatabaseModule {}