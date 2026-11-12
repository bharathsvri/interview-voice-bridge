import { Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../database';
import { hashPassword, comparePassword, hashToken } from '../utils/crypto';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../auth/jwt';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  deviceId: z.string().optional(),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export async function register(req: Request, res: Response): Promise<void> {
  const { email, password, name } = req.body;
  const existing = await db.findUserByEmail(email);
  if (existing) {
    res.status(409).json({
      success: false,
      error: { code: 'EMAIL_ALREADY_EXISTS', message: 'A user with this email already exists' },
      requestId: req.requestId || '',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const passwordHash = await hashPassword(password);
  const user = await db.createUser({ email, passwordHash, name });

  const tokenPayload = { userId: user.id, email: user.email };
  const accessToken = signAccessToken(tokenPayload);
  const refreshToken = signRefreshToken(tokenPayload);

  // Store refresh token
  const tokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await db.createRefreshToken({ userId: user.id, tokenHash, expiresAt });

  res.status(201).json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: 900,
      },
    },
    requestId: req.requestId || '',
    timestamp: new Date().toISOString(),
  });
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password, deviceId } = req.body;
  const user = await db.findUserByEmail(email);
  if (!user) {
    res.status(401).json({
      success: false,
      error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      requestId: req.requestId || '',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({
      success: false,
      error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      requestId: req.requestId || '',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const tokenPayload = { userId: user.id, email: user.email, deviceId };
  const accessToken = signAccessToken(tokenPayload);
  const refreshToken = signRefreshToken(tokenPayload);

  const tokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await db.createRefreshToken({ userId: user.id, tokenHash, expiresAt });

  res.status(200).json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: 900,
      },
    },
    requestId: req.requestId || '',
    timestamp: new Date().toISOString(),
  });
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const { refreshToken } = req.body;
  const tokenHash = hashToken(refreshToken);

  const tokenRecord = await db.findRefreshToken(tokenHash);
  if (!tokenRecord || tokenRecord.revoked || new Date() > tokenRecord.expiresAt) {
    res.status(401).json({
      success: false,
      error: { code: 'INVALID_REFRESH_TOKEN', message: 'Refresh token is expired, revoked, or invalid' },
      requestId: req.requestId || '',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  try {
    const payload = verifyRefreshToken(refreshToken);
    // Revoke old token for token rotation
    await db.revokeRefreshToken(tokenHash);

    const newAccessToken = signAccessToken({ userId: payload.userId, email: payload.email, deviceId: payload.deviceId });
    const newRefreshToken = signRefreshToken({ userId: payload.userId, email: payload.email, deviceId: payload.deviceId });

    const newHash = hashToken(newRefreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db.createRefreshToken({ userId: payload.userId, tokenHash: newHash, expiresAt });

    res.status(200).json({
      success: true,
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: 900,
      },
      requestId: req.requestId || '',
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(401).json({
      success: false,
      error: { code: 'INVALID_REFRESH_TOKEN', message: err.message || 'Token verification failed' },
      requestId: req.requestId || '',
      timestamp: new Date().toISOString(),
    });
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  const { refreshToken } = req.body;
  if (refreshToken) {
    const tokenHash = hashToken(refreshToken);
    await db.revokeRefreshToken(tokenHash);
  }

  res.status(200).json({
    success: true,
    data: { message: 'Logged out successfully' },
    requestId: req.requestId || '',
    timestamp: new Date().toISOString(),
  });
}
