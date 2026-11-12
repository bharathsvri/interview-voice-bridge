import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../app';
import { db } from '../database';

describe('Transcription Sessions & Segments API Tests', () => {
  let authToken: string;
  let desktopId = 'desktop-session-test';
  let androidId = 'android-session-test';

  beforeEach(async () => {
    db.clearInMemory();
    const regRes = await request(app).post('/api/v1/auth/register').send({
      email: 'session@example.com',
      password: 'StrongPassword123!',
      name: 'Session Candidate',
    });
    authToken = regRes.body.data.tokens.accessToken;

    // Register devices
    await request(app)
      .post('/api/v1/devices/pair/initiate')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ deviceId: desktopId, name: 'Desktop Mac' });

    await request(app)
      .post('/api/v1/devices/pair/initiate')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ deviceId: androidId, name: 'Android Device', deviceType: 'android' });
  });

  it('should create a new transcription session', async () => {
    const res = await request(app)
      .post('/api/v1/sessions')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        desktopDeviceId: desktopId,
        androidDeviceId: androidId,
        isPersistenceEnabled: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('active');
  });

  it('should fetch, stop, and retrieve transcript segments for a session', async () => {
    const sessionRes = await request(app)
      .post('/api/v1/sessions')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        desktopDeviceId: desktopId,
        androidDeviceId: androidId,
      });

    const sessionId = sessionRes.body.data.id;

    // Insert mock segments into db
    await db.createSegment({
      sessionId,
      sequenceNumber: 1,
      text: 'Tell me about yourself.',
      isFinal: true,
      timestamp: Date.now(),
    });
    await db.createSegment({
      sessionId,
      sequenceNumber: 2,
      text: 'I am a full stack software engineer.',
      isFinal: true,
      timestamp: Date.now(),
    });

    // Get transcripts
    const transcriptRes = await request(app)
      .get(`/api/v1/transcriptions/${sessionId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(transcriptRes.status).toBe(200);
    expect(transcriptRes.body.data.segments).toHaveLength(2);
    expect(transcriptRes.body.data.fullFinalText).toBe(
      'Tell me about yourself. I am a full stack software engineer.'
    );

    // Stop session
    const stopRes = await request(app)
      .post(`/api/v1/sessions/${sessionId}/stop`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(stopRes.status).toBe(200);
    expect(stopRes.body.data.status).toBe('completed');
  });
});
