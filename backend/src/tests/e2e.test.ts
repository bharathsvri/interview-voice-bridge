import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import WebSocket from 'ws';
import request from 'supertest';
import { app } from '../app';
import { WebSocketGateway } from '../websocket/gateway';
import { db } from '../database';
import { WebSocketEnvelope } from '@interview-voice-bridge/shared-types';

describe('Complete End-to-End Workflow Verification', () => {
  let server: http.Server;
  let gateway: WebSocketGateway;
  let port: number;
  let wsUrl: string;

  beforeAll(async () => {
    db.clearInMemory();
    server = http.createServer(app);
    gateway = new WebSocketGateway(server);

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        port = (server.address() as any).port;
        wsUrl = `ws://localhost:${port}/ws`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    gateway.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('executes full end-to-end workflow: auth -> pairing -> session -> audio -> Deepgram -> Android -> zero-auto-submit check', async () => {
    // 1. Authenticate user
    const regRes = await request(app).post('/api/v1/auth/register').send({
      email: 'e2e@candidate.com',
      password: 'SecurePassword123!',
      name: 'E2E Candidate',
    });
    expect(regRes.status).toBe(201);
    const token = regRes.body.data.tokens.accessToken;

    const desktopDeviceId = 'e2e-desktop-mac';
    const androidDeviceId = 'e2e-android-pixel';

    // 2. Initiate device pairing from Desktop
    const initRes = await request(app)
      .post('/api/v1/devices/pair/initiate')
      .set('Authorization', `Bearer ${token}`)
      .send({
        deviceId: desktopDeviceId,
        name: 'MacBook Pro',
        deviceType: 'desktop',
      });
    expect(initRes.status).toBe(200);
    const { pairingCode, oneTimeToken } = initRes.body.data;
    expect(pairingCode).toHaveLength(6);

    // 3. Approve device pairing from Android
    const approveRes = await request(app)
      .post('/api/v1/devices/pair/approve')
      .set('Authorization', `Bearer ${token}`)
      .send({
        pairingCode,
        approvingDeviceId: androidDeviceId,
        name: 'Pixel 8 Pro',
        deviceType: 'android',
      });
    expect(approveRes.status).toBe(200);

    // 4. Complete pairing handshake
    const completeRes = await request(app)
      .post('/api/v1/devices/pair/complete')
      .set('Authorization', `Bearer ${token}`)
      .send({
        pairingCode,
        oneTimeToken,
      });
    expect(completeRes.status).toBe(200);

    // 5. Connect Desktop and Android to WebSocket Gateway
    const desktopWs = new WebSocket(
      `${wsUrl}?token=${token}&deviceId=${desktopDeviceId}&deviceType=desktop`
    );
    await new Promise<void>((r) => desktopWs.once('open', r));

    const androidWs = new WebSocket(
      `${wsUrl}?token=${token}&deviceId=${androidDeviceId}&deviceType=android`
    );
    await new Promise<void>((r) => androidWs.once('open', r));

    // 6. Create transcription session
    const sessionRes = await request(app)
      .post('/api/v1/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        desktopDeviceId,
        androidDeviceId,
        isPersistenceEnabled: true,
      });
    expect(sessionRes.status).toBe(201);
    const sessionId = sessionRes.body.data.id;

    // 7. Android subscribes to session
    androidWs.send(
      JSON.stringify({
        eventId: 'sub-e2e',
        sessionId,
        deviceId: androidDeviceId,
        timestamp: Date.now(),
        eventType: 'android:transcription:subscribe',
        payload: { sessionId },
      })
    );

    // Setup listener on Android client for transcription delivery
    const deliveredFinalTranscripts: any[] = [];
    androidWs.on('message', (raw) => {
      const env: WebSocketEnvelope = JSON.parse(raw.toString());
      if (env.eventType === 'transcription:final') {
        deliveredFinalTranscripts.push(env.payload);
      }
    });

    // 8. Desktop starts audio streaming
    desktopWs.send(
      JSON.stringify({
        eventId: 'audio-start-e2e',
        sessionId,
        deviceId: desktopDeviceId,
        timestamp: Date.now(),
        eventType: 'desktop:audio:start',
        payload: { sessionId, sampleRate: 16000, channels: 1 },
      })
    );

    await new Promise((r) => setTimeout(r, 150));

    // 9. Stream simulated audio chunk from desktop
    const dummyAudioBuffer = Buffer.alloc(4096, 0x1a);
    desktopWs.send(dummyAudioBuffer);

    // 10. Deepgram emits interim & final transcription
    const ctx = gateway.getSessionContext(sessionId);
    expect(ctx).toBeDefined();

    ctx!.deepgramService.simulateTranscription(
      'Can you explain the difference between processes and threads?',
      true
    );

    // Wait for event routing to Android
    await new Promise((r) => setTimeout(r, 200));

    expect(deliveredFinalTranscripts.length).toBe(1);
    expect(deliveredFinalTranscripts[0].text).toBe(
      'Can you explain the difference between processes and threads?'
    );

    // 11. Verify zero auto-submit guarantee:
    // Ensure that no submit event or action is ever triggered
    expect((deliveredFinalTranscripts[0] as any).autoSubmit).toBeUndefined();

    // 12. Desktop stops audio streaming
    desktopWs.send(
      JSON.stringify({
        eventId: 'audio-stop-e2e',
        sessionId,
        deviceId: desktopDeviceId,
        timestamp: Date.now(),
        eventType: 'desktop:audio:stop',
        payload: { sessionId },
      })
    );

    // 13. Stop session via REST
    const stopRes = await request(app)
      .post(`/api/v1/sessions/${sessionId}/stop`)
      .set('Authorization', `Bearer ${token}`);
    expect(stopRes.status).toBe(200);

    // 14. Verify transcripts stored in session
    const getTranscriptRes = await request(app)
      .get(`/api/v1/transcriptions/${sessionId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(getTranscriptRes.status).toBe(200);
    expect(getTranscriptRes.body.data.segments.length).toBe(1);

    desktopWs.close();
    androidWs.close();
  });
});
