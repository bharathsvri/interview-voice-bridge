import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction): void {
  const status = err.status || err.statusCode || 500;
  const code = err.code || 'INTERNAL_SERVER_ERROR';
  const message = err.message || 'An unexpected error occurred';

  logger.error(
    {
      err,
      requestId: req.requestId,
      method: req.method,
      path: req.path,
    },
    'Request error'
  );

  res.status(status).json({
    success: false,
    error: {
      code,
      message,
    },
    requestId: req.requestId || '',
    timestamp: new Date().toISOString(),
  });
}
