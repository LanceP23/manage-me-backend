import { ConfigService } from '@nestjs/config';

export const getDatabaseConfig = (configService: ConfigService) => ({
  type: 'postgres' as const,
  host: configService.get<string>('DB_HOST', '127.0.0.1'),
  port: configService.get<number>('DB_PORT', 5433),
  username: configService.get<string>('DB_USERNAME', 'postgres'),
  password: configService.get<string>('DB_PASSWORD', 'postgres'),
  database: configService.get<string>('DB_NAME', 'manage_me_db'),
  synchronize: configService.get<boolean>('DB_SYNCHRONIZE', true),
  logging: configService.get<boolean>('DB_LOGGING', false),
  autoLoadEntities: true,
  ssl: false, 
  extra: {
    ssl: false,
  },
  entities: ['dist/**/*.entity{.ts,.js}'],
  migrations: ['dist/migrations/**/*{.ts,.js}'],
  subscribers: ['dist/subscribers/**/*{.ts,.js}'],
});