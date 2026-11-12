import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import WebSocket from 'ws';
import { app } from '../app';
import { WebSocketGateway } from '../websocket/gateway';
import { signAccessToken } from '../auth/jwt';
import { db } from '../database';
import { WebSocketEnvelope } from '@interview-voice-bridge/shared-types';

describe('WebSocket Real-Time Transcription Pipeline Integration Tests', () => {
  let server: http.Server;
  let gateway: WebSocketGateway;
  let port: number;
  let token: string;
  const desktopDeviceId = 'ws-test-desktop-id';
  const androidDeviceId = 'ws-test-android-id';
  let sessionId: string;

  beforeAll(async () => {
    db.clearInMemory();
    const user = await db.createUser({
      email: 'ws@example.com',
      passwordHash: 'dummyhash',
      name: 'WebSocket Test User',
    });

    token = signAccessToken({ userId: user.id, email: user.email });

    await db.upsertDevice({
      id: desktopDeviceId,
      userId: user.id,
      name: 'Test Desktop',
      deviceType: 'desktop',
    });

    await db.upsertDevice({
      id: androidDeviceId,
      userId: user.id,
      name: 'Test Android',
      deviceType: 'android',
    });

    await db.pairDevices(desktopDeviceId, androidDeviceId);

    const session = await db.createSession({
      userId: user.id,
      desktopDeviceId,
      androidDeviceId,
    });
    sessionId = session.id;

    server = http.createServer(app);
    gateway = new WebSocketGateway(server);

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        port = (server.address() as any).port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    gateway.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('should authenticate both desktop and android clients, stream transcription, and receive events', async () => {
    const wsUrl = `ws://localhost:${port}/ws`;

    // 1. Connect Desktop
    const desktopWs = new WebSocket(`${wsUrl}?token=${token}&deviceId=${desktopDeviceId}&deviceType=desktop`);
    await new Promise<void>((resolve) => desktopWs.once('open', resolve));

    // 2. Connect Android
    const androidWs = new WebSocket(`${wsUrl}?token=${token}&deviceId=${androidDeviceId}&deviceType=android`);
    await new Promise<void>((resolve) => androidWs.once('open', resolve));

    // 3. Android subscribes to session
    androidWs.send(
      JSON.stringify({
        eventId: 'sub-1',
        sessionId,
        deviceId: androidDeviceId,
        timestamp: Date.now(),
        eventType: 'android:transcription:subscribe',
        payload: { sessionId },
      })
    );

    // Prepare promise to capture received transcription on Android
    const receivedEventsPromise = new Promise<{ interim?: any; final?: any }>((resolve) => {
      const captured: { interim?: any; final?: any } = {};
      androidWs.on('message', (data) => {
        const env: WebSocketEnvelope = JSON.parse(data.toString());
        if (env.eventType === 'transcription:interim') {
          captured.interim = env.payload;
        }
        if (env.eventType === 'transcription:final') {
          captured.final = env.payload;
        }
        if (captured.interim && captured.final) {
          resolve(captured);
        }
      });
    });

    // 4. Desktop starts audio
    desktopWs.send(
      JSON.stringify({
        eventId: 'start-1',
        sessionId,
        deviceId: desktopDeviceId,
        timestamp: Date.now(),
        eventType: 'desktop:audio:start',
        payload: { sessionId, sampleRate: 16000, channels: 1 },
      })
    );

    // Wait a brief moment for session registration in gateway
    await new Promise((r) => setTimeout(r, 100));

    // Gateway session context has simulated transcription trigger for testing
    const ctx = gateway.getSessionContext(sessionId);
    expect(ctx).toBeDefined();

    // Trigger interim and final simulated transcription
    ctx!.deepgramService.simulateTranscription('Explain microservices', false);
    ctx!.deepgramService.simulateTranscription('Explain microservices architecture.', true);

    const received = await receivedEventsPromise;
    expect(received.interim.text).toBe('Explain microservices');
    expect(received.final.text).toBe('Explain microservices architecture.');

    // 5. Desktop stops audio
    desktopWs.send(
      JSON.stringify({
        eventId: 'stop-1',
        sessionId,
        deviceId: desktopDeviceId,
        timestamp: Date.now(),
        eventType: 'desktop:audio:stop',
        payload: { sessionId },
      })
    );

    desktopWs.close();
    androidWs.close();
  });
});
