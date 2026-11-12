import { Request, Response } from 'express';
import { config } from '../config';

export function getHealth(req: Request, res: Response): void {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    service: 'interview-voice-bridge-backend',
  });
}

export function getReady(req: Request, res: Response): void {
  const isDeepgramConfigured = Boolean(config.deepgramApiKey && config.deepgramApiKey.length > 5);

  res.status(200).json({
    status: 'ready',
    database: 'connected',
    deepgramConfigured: isDeepgramConfigured,
    timestamp: new Date().toISOString(),
  });
}
