import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, TokenPayload } from '../auth/jwt';
import { db } from '../database';

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
      requestId?: string;
    }
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Missing or invalid Authorization header' },
      requestId: req.requestId || '',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const token = authHeader.substring(7);
  try {
    const payload = verifyAccessToken(token);
    const user = await db.findUserById(payload.userId);
    if (!user) {
      res.status(401).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User does not exist or has been deleted' },
        requestId: req.requestId || '',
        timestamp: new Date().toISOString(),
      });
      return;
    }
    req.user = payload;
    next();
  } catch (err: any) {
    res.status(401).json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: err.message || 'Token verification failed' },
      requestId: req.requestId || '',
      timestamp: new Date().toISOString(),
    });
  }
}
