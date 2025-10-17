const trim = (v?: string) => (typeof v === 'string' ? v.trim() : '');

// Provide default values in case environment variables are not loaded yet
const DB_HOST = process.env.DB_HOST ? trim(process.env.DB_HOST) : '127.0.0.1';
const DB_PORT = process.env.DB_PORT ? parseInt(trim(process.env.DB_PORT), 10) : 5433;
const DB_USERNAME = process.env.DB_USERNAME ? trim(process.env.DB_USERNAME) : 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD ? trim(process.env.DB_PASSWORD) : 'postgres';
const DB_NAME = process.env.DB_NAME ? trim(process.env.DB_NAME) : 'manage_me_db';

console.log('[DATABASE_CONFIG] Processed configuration:', {
  host: DB_HOST,
  port: DB_PORT,
  username: DB_USERNAME,
  passwordLength: DB_PASSWORD.length,
  database: DB_NAME,
});

export const DATABASE_CONFIG = {
  TYPE: 'postgres',
  HOST: DB_HOST,
  PORT: DB_PORT,
  USERNAME: DB_USERNAME,
  PASSWORD: DB_PASSWORD,
  DATABASE: DB_NAME,
  SYNCHRONIZE: trim(process.env.DB_SYNCHRONIZE) === 'true' || false,
  LOGGING: trim(process.env.DB_LOGGING) === 'true' || false,
  AUTO_LOAD_ENTITIES: true,
  SSL: trim(process.env.DB_SSL) === 'true' || false,
} as const;