import { Request, Response } from 'express';
import { db } from '../database';

export async function getTranscriptions(req: Request, res: Response): Promise<void> {
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

  const segments = await db.getSegmentsBySessionId(sessionId);
  const finalSegments = segments.filter((s) => s.isFinal);
  const fullFinalText = finalSegments.map((s) => s.text.trim()).join(' ');

  res.status(200).json({
    success: true,
    data: {
      sessionId,
      segments: segments.map((s) => ({
        id: s.id,
        sessionId: s.sessionId,
        sequenceNumber: s.sequenceNumber,
        text: s.text,
        isFinal: s.isFinal,
        timestamp: s.timestamp,
        confidence: s.confidence,
        language: s.language,
      })),
      totalSegments: segments.length,
      fullFinalText,
    },
    requestId: req.requestId || '',
    timestamp: new Date().toISOString(),
  });
}

export async function deleteTranscriptions(req: Request, res: Response): Promise<void> {
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

  await db.deleteSegmentsBySessionId(sessionId);

  res.status(200).json({
    success: true,
    data: { message: 'Transcripts for session deleted successfully' },
    requestId: req.requestId || '',
    timestamp: new Date().toISOString(),
  });
}
