import { Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../database';

export const createSessionSchema = z.object({
  desktopDeviceId: z.string().min(1),
  androidDeviceId: z.string().min(1),
  isPersistenceEnabled: z.boolean().optional(),
});

export async function createSession(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { desktopDeviceId, androidDeviceId, isPersistenceEnabled } = req.body;

  const desktop = await db.getDeviceById(desktopDeviceId);
  const android = await db.getDeviceById(androidDeviceId);

  if (!desktop || desktop.userId !== userId || !android || android.userId !== userId) {
    res.status(404).json({
      success: false,
      error: { code: 'DEVICE_NOT_FOUND', message: 'One or both devices not found or not owned by user' },
      requestId: req.requestId || '',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const session = await db.createSession({
    userId,
    desktopDeviceId,
    androidDeviceId,
    isPersistenceEnabled: isPersistenceEnabled ?? true,
  });

  res.status(201).json({
    success: true,
    data: {
      id: session.id,
      userId: session.userId,
      desktopDeviceId: session.desktopDeviceId,
      androidDeviceId: session.androidDeviceId,
      status: session.status,
      isPersistenceEnabled: session.isPersistenceEnabled,
      startedAt: session.startedAt.toISOString(),
    },
    requestId: req.requestId || '',
    timestamp: new Date().toISOString(),
  });
}

export async function getSession(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { sessionId } = req.params;

  const session = await db.getSessionById(sessionId);
  if (!session || session.userId !== userId) {
    res.status(404).json({
      success: false,
      error: { code: 'SESSION_NOT_FOUND', message: 'Session not found' },
      requestId: req.requestId || '',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  res.status(200).json({
    success: true,
    data: {
      id: session.id,
      userId: session.userId,
      desktopDeviceId: session.desktopDeviceId,
      androidDeviceId: session.androidDeviceId,
      status: session.status,
      isPersistenceEnabled: session.isPersistenceEnabled,
      startedAt: session.startedAt.toISOString(),
      endedAt: session.endedAt?.toISOString(),
    },
    requestId: req.requestId || '',
    timestamp: new Date().toISOString(),
  });
}

export async function startSession(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { sessionId } = req.params;

  const session = await db.getSessionById(sessionId);
  if (!session || session.userId !== userId) {
    res.status(404).json({
      success: false,
      error: { code: 'SESSION_NOT_FOUND', message: 'Session not found' },
      requestId: req.requestId || '',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  await db.updateSessionStatus(sessionId, 'active');

  res.status(200).json({
    success: true,
    data: { id: sessionId, status: 'active' },
    requestId: req.requestId || '',
    timestamp: new Date().toISOString(),
  });
}

export async function stopSession(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { sessionId } = req.params;

  const session = await db.getSessionById(sessionId);
  if (!session || session.userId !== userId) {
    res.status(404).json({
      success: false,
      error: { code: 'SESSION_NOT_FOUND', message: 'Session not found' },
      requestId: req.requestId || '',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  await db.updateSessionStatus(sessionId, 'completed');

  res.status(200).json({
    success: true,
    data: { id: sessionId, status: 'completed' },
    requestId: req.requestId || '',
    timestamp: new Date().toISOString(),
  });
}

export async function deleteSession(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { sessionId } = req.params;

  const session = await db.getSessionById(sessionId);
  if (!session || session.userId !== userId) {
    res.status(404).json({
      success: false,
      error: { code: 'SESSION_NOT_FOUND', message: 'Session not found' },
      requestId: req.requestId || '',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  await db.deleteSession(sessionId);

  res.status(200).json({
    success: true,
    data: { message: 'Session and associated transcripts deleted successfully' },
    requestId: req.requestId || '',
    timestamp: new Date().toISOString(),
  });
}
