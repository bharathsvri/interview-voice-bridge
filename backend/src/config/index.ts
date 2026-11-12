import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root or backend folder
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

export interface AppConfig {
  port: number;
  nodeEnv: string;
  databaseUrl: string;
  redisUrl?: string;
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  jwtAccessExpiration: string; // e.g. '15m'
  jwtRefreshExpiration: string; // e.g. '7d'
  pairingCodeExpirationSeconds: number; // e.g. 300
  deepgramApiKey?: string;
  corsOrigin: string;
  rateLimitWindowMs: number;
  rateLimitMax: number;
}

export const config: AppConfig = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/interview_voice_bridge?schema=public',
  redisUrl: process.env.REDIS_URL,
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || 'dev_jwt_access_secret_interview_voice_bridge_2026',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'dev_jwt_refresh_secret_interview_voice_bridge_2026',
  jwtAccessExpiration: process.env.JWT_ACCESS_EXPIRATION || '15m',
  jwtRefreshExpiration: process.env.JWT_REFRESH_EXPIRATION || '7d',
  pairingCodeExpirationSeconds: parseInt(process.env.PAIRING_CODE_EXPIRATION_SECONDS || '300', 10),
  deepgramApiKey: process.env.DEEPGRAM_API_KEY,
  corsOrigin: process.env.CORS_ORIGIN || '*',
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 mins
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
};
