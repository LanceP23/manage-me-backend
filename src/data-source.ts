import 'tsconfig-paths/register';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

if (process.env.NO_DOTENV !== 'true') {
  dotenv.config();
}

const trim = (v?: string) => (typeof v === 'string' ? v.trim() : '');

const effectiveHost = process.env.DB_HOST ? trim(process.env.DB_HOST) : '127.0.0.1';
const effectivePort = process.env.DB_PORT ? parseInt(trim(process.env.DB_PORT), 10) : 5433;
const effectiveUser = process.env.DB_USERNAME ? trim(process.env.DB_USERNAME) : 'postgres';
const effectivePassword = process.env.DB_PASSWORD ? trim(process.env.DB_PASSWORD) : 'postgres';
const effectiveDb = process.env.DB_NAME ? trim(process.env.DB_NAME) : 'manage_me_db';

export const dataSource = new DataSource({
  type: 'postgres',
  host: effectiveHost,
  port: effectivePort,
  username: effectiveUser,
  password: effectivePassword,
  database: effectiveDb,
  synchronize: process.env.DB_SYNCHRONIZE === 'true' || false,
  logging: process.env.DB_LOGGING === 'true' || false,
  entities: ['src/**/*.entity.{ts,js}'],
  migrations: ['src/migrations/**/*.{ts,js}'],
  subscribers: ['src/subscribers/**/*.{ts,js}'],
});
