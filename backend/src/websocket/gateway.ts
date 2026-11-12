import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage, Server } from 'http';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { verifyAccessToken, TokenPayload } from '../auth/jwt';
import { db } from '../database';
import { DeepgramService } from '../deepgram/deepgram.service';
import { WebSocketEnvelope, WebSocketEventType } from '@interview-voice-bridge/shared-types';

interface AuthenticatedClient {
  ws: WebSocket;
  user: TokenPayload;
  deviceId: string;
  deviceType: 'desktop' | 'android';
  activeSessionId?: string;
  isAlive: boolean;
  lastHeartbeat: number;
}

interface ActiveSessionContext {
  sessionId: string;
  userId: string;
  desktopDeviceId: string;
  androidDeviceId: string;
  deepgramService: DeepgramService;
  sequenceCounter: number;
  isStreaming: boolean;
}

export class WebSocketGateway {
  private wss: WebSocketServer;
  private clients: Map<string, AuthenticatedClient> = new Map(); // key: deviceId
  private activeSessions: Map<string, ActiveSessionContext> = new Map(); // key: sessionId
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(server: Server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.initialize();
  }

  private initialize(): void {
    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      this.handleConnection(ws, req);
    });

    // Heartbeat check every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      this.checkHeartbeats();
    }, 30000);
  }

  public close(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Close all sessions and Deepgram clients
    for (const ctx of this.activeSessions.values()) {
      ctx.deepgramService.close();
    }
    this.activeSessions.clear();

    for (const client of this.clients.values()) {
      client.ws.close();
    }
    this.clients.clear();
    this.wss.close();
  }

  private checkHeartbeats(): void {
    const now = Date.now();
    for (const [deviceId, client] of this.clients.entries()) {
      if (!client.isAlive || now - client.lastHeartbeat > 65000) {
        logger.info({ deviceId }, 'Terminating stale WebSocket connection');
        client.ws.terminate();
        this.clients.delete(deviceId);
        db.updateDeviceStatus(deviceId, false).catch(() => {});
      } else {
        client.isAlive = false;
        try {
          client.ws.ping();
        } catch (e) {
          // ignore
        }
      }
    }
  }

  private handleConnection(ws: WebSocket, req: IncomingMessage): void {
    // Initial token parsing from query string or wait for connect message
    const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
    const token = url.searchParams.get('token');
    const deviceIdParam = url.searchParams.get('deviceId');
    const deviceTypeParam = (url.searchParams.get('deviceType') as 'desktop' | 'android') || 'desktop';

    let registeredClient: AuthenticatedClient | null = null;

    if (token && deviceIdParam) {
      try {
        const payload = verifyAccessToken(token);
        registeredClient = {
          ws,
          user: payload,
          deviceId: deviceIdParam,
          deviceType: deviceTypeParam,
          isAlive: true,
          lastHeartbeat: Date.now(),
        };
        this.clients.set(deviceIdParam, registeredClient);
        db.updateDeviceStatus(deviceIdParam, true).catch(() => {});
        logger.info({ deviceId: deviceIdParam, deviceType: deviceTypeParam }, 'WebSocket client connected via query params');
        this.sendEnvelope(ws, {
          eventId: uuidv4(),
          sessionId: '',
          deviceId: deviceIdParam,
          timestamp: Date.now(),
          eventType: 'device:connected',
          payload: { isOnline: true, deviceId: deviceIdParam },
        });
      } catch (err: any) {
        logger.warn({ err: err.message }, 'Failed to authenticate connection from query params');
      }
    }

    ws.on('pong', () => {
      if (registeredClient) {
        registeredClient.isAlive = true;
        registeredClient.lastHeartbeat = Date.now();
      }
    });

    ws.on('message', async (data: Buffer | string, isBinary: boolean) => {
      try {
        if (isBinary) {
          // Binary audio chunk from desktop
          this.handleBinaryAudioChunk(registeredClient, data as Buffer);
          return;
        }

        const messageText = data.toString();
        const envelope: WebSocketEnvelope = JSON.parse(messageText);

        if (!registeredClient) {
          registeredClient = await this.handleInitialConnect(ws, envelope);
          return;
        }

        registeredClient.lastHeartbeat = Date.now();
        await this.handleEnvelope(registeredClient, envelope);
      } catch (err: any) {
        logger.error({ err: err.message }, 'WebSocket message handling error');
        this.sendEnvelope(ws, {
          eventId: uuidv4(),
          sessionId: '',
          deviceId: registeredClient?.deviceId || '',
          timestamp: Date.now(),
          eventType: 'transcription:error',
          payload: { code: 'INVALID_MESSAGE', message: err.message, recoverable: true },
        });
      }
    });

    ws.on('close', () => {
      if (registeredClient) {
        const deviceId = registeredClient.deviceId;
        this.clients.delete(deviceId);
        db.updateDeviceStatus(deviceId, false).catch(() => {});
        logger.info({ deviceId }, 'WebSocket client disconnected');

        // Notify paired peer if exists
        this.notifyPeerDisconnection(registeredClient);
      }
    });

    ws.on('error', (err) => {
      logger.error({ err: err.message, deviceId: registeredClient?.deviceId }, 'WebSocket error');
    });
  }

  private async handleInitialConnect(
    ws: WebSocket,
    envelope: WebSocketEnvelope
  ): Promise<AuthenticatedClient | null> {
    if (envelope.eventType !== 'desktop:connect' && envelope.eventType !== 'android:connect') {
      ws.close(4001, 'Unauthorized: Must send connect message first');
      return null;
    }

    const payload = envelope.payload as { token: string; deviceId: string };
    if (!payload?.token || !payload?.deviceId) {
      ws.close(4002, 'Bad Request: Missing token or deviceId');
      return null;
    }

    try {
      const user = verifyAccessToken(payload.token);
      const deviceType = envelope.eventType === 'desktop:connect' ? 'desktop' : 'android';
      const client: AuthenticatedClient = {
        ws,
        user,
        deviceId: payload.deviceId,
        deviceType,
        isAlive: true,
        lastHeartbeat: Date.now(),
      };

      this.clients.set(payload.deviceId, client);
      await db.updateDeviceStatus(payload.deviceId, true);
      logger.info({ deviceId: payload.deviceId, deviceType }, 'WebSocket client authenticated successfully');

      this.sendEnvelope(ws, {
        eventId: uuidv4(),
        sessionId: '',
        deviceId: payload.deviceId,
        timestamp: Date.now(),
        eventType: 'device:connected',
        payload: { isOnline: true, deviceId: payload.deviceId },
      });

      return client;
    } catch (err: any) {
      ws.close(4003, 'Unauthorized: Invalid token');
      return null;
    }
  }

  private async handleEnvelope(client: AuthenticatedClient, envelope: WebSocketEnvelope): Promise<void> {
    switch (envelope.eventType) {
      case 'connection:heartbeat': {
        this.sendEnvelope(client.ws, {
          eventId: uuidv4(),
          sessionId: envelope.sessionId || '',
          deviceId: client.deviceId,
          timestamp: Date.now(),
          eventType: 'connection:heartbeat',
          payload: {
            sequence: (envelope.payload as any)?.sequence || 0,
            clientTimestamp: (envelope.payload as any)?.clientTimestamp || Date.now(),
            serverTimestamp: Date.now(),
          },
        });
        break;
      }

      case 'desktop:audio:start': {
        await this.handleAudioStart(client, envelope);
        break;
      }

      case 'desktop:audio:chunk': {
        this.handleAudioChunkPayload(client, envelope);
        break;
      }

      case 'desktop:audio:stop': {
        await this.handleAudioStop(client, envelope);
        break;
      }

      case 'android:transcription:subscribe': {
        client.activeSessionId = envelope.sessionId;
        logger.info({ deviceId: client.deviceId, sessionId: envelope.sessionId }, 'Android client subscribed to session');
        break;
      }

      case 'android:transcription:unsubscribe': {
        client.activeSessionId = undefined;
        logger.info({ deviceId: client.deviceId, sessionId: envelope.sessionId }, 'Android client unsubscribed');
        break;
      }

      default:
        logger.debug({ eventType: envelope.eventType }, 'Unhandled WebSocket event');
    }
  }

  private async handleAudioStart(client: AuthenticatedClient, envelope: WebSocketEnvelope): Promise<void> {
    const sessionId = envelope.sessionId;
    const session = await db.getSessionById(sessionId);

    if (!session || session.userId !== client.user.userId || session.desktopDeviceId !== client.deviceId) {
      this.sendEnvelope(client.ws, {
        eventId: uuidv4(),
        sessionId,
        deviceId: client.deviceId,
        timestamp: Date.now(),
        eventType: 'transcription:error',
        payload: { code: 'UNAUTHORIZED_SESSION', message: 'Session unauthorized or not found', recoverable: false },
      });
      return;
    }

    client.activeSessionId = sessionId;

    let sessionContext = this.activeSessions.get(sessionId);
    if (!sessionContext) {
      const payload = envelope.payload as any;
      const deepgram = new DeepgramService({
        sampleRate: payload?.sampleRate || 16000,
        channels: payload?.channels || 1,
        language: payload?.language || 'en',
      });

      sessionContext = {
        sessionId,
        userId: client.user.userId,
        desktopDeviceId: session.desktopDeviceId,
        androidDeviceId: session.androidDeviceId,
        deepgramService: deepgram,
        sequenceCounter: 0,
        isStreaming: false,
      };

      // Set Deepgram event handlers
      deepgram.setCallbacks({
        onInterim: (data) => this.broadcastTranscription(sessionContext!, data, false),
        onFinal: async (data) => {
          sessionContext!.sequenceCounter++;
          const seg = await db.createSegment({
            sessionId,
            sequenceNumber: sessionContext!.sequenceCounter,
            text: data.text,
            isFinal: true,
            timestamp: data.timestamp,
            confidence: data.confidence,
            language: data.language,
          });
          this.broadcastTranscription(sessionContext!, { ...data, id: seg.id }, true);
        },
        onError: (err) => {
          this.broadcastToSession(sessionContext!, 'transcription:error', {
            code: 'DEEPGRAM_ERROR',
            message: err.message,
            recoverable: true,
          });
        },
      });

      await deepgram.connect();
      this.activeSessions.set(sessionId, sessionContext);
    }

    sessionContext.deepgramService.startTranscription();
    sessionContext.isStreaming = true;

    this.broadcastToSession(sessionContext, 'session:started', {
      sessionId,
      status: 'active',
      desktopDeviceId: sessionContext.desktopDeviceId,
      androidDeviceId: sessionContext.androidDeviceId,
      timestamp: Date.now(),
    });
  }

  private handleAudioChunkPayload(client: AuthenticatedClient, envelope: WebSocketEnvelope): void {
    const sessionId = envelope.sessionId || client.activeSessionId;
    if (!sessionId) return;

    const ctx = this.activeSessions.get(sessionId);
    if (!ctx || !ctx.isStreaming) return;

    const payload = envelope.payload as { audioBase64: string };
    if (payload?.audioBase64) {
      ctx.deepgramService.sendAudio(payload.audioBase64);
    }
  }

  private handleBinaryAudioChunk(client: AuthenticatedClient | null, chunk: Buffer): void {
    if (!client || !client.activeSessionId) return;

    const ctx = this.activeSessions.get(client.activeSessionId);
    if (!ctx || !ctx.isStreaming) return;

    ctx.deepgramService.sendAudio(chunk);
  }

  private async handleAudioStop(client: AuthenticatedClient, envelope: WebSocketEnvelope): Promise<void> {
    const sessionId = envelope.sessionId || client.activeSessionId;
    if (!sessionId) return;

    const ctx = this.activeSessions.get(sessionId);
    if (ctx) {
      ctx.isStreaming = false;
      ctx.deepgramService.stopTranscription();
      this.broadcastToSession(ctx, 'session:stopped', {
        sessionId,
        status: 'completed',
        desktopDeviceId: ctx.desktopDeviceId,
        androidDeviceId: ctx.androidDeviceId,
        timestamp: Date.now(),
      });
    }
  }

  private broadcastTranscription(
    ctx: ActiveSessionContext,
    data: { text: string; confidence: number; language: string; timestamp: number; id?: string },
    isFinal: boolean
  ): void {
    const eventType = isFinal ? 'transcription:final' : 'transcription:interim';
    const payload = {
      sessionId: ctx.sessionId,
      segmentId: data.id || uuidv4(),
      text: data.text,
      isFinal,
      timestamp: data.timestamp,
      sequenceNumber: ctx.sequenceCounter,
      confidence: data.confidence,
      language: data.language,
    };

    this.broadcastToSession(ctx, eventType, payload);
  }

  public broadcastToSession(ctx: ActiveSessionContext, eventType: WebSocketEventType, payload: any): void {
    const envelope: WebSocketEnvelope = {
      eventId: uuidv4(),
      sessionId: ctx.sessionId,
      deviceId: 'server',
      timestamp: Date.now(),
      eventType,
      payload,
    };

    // Forward strictly to authorized desktop and paired android clients
    const desktopClient = this.clients.get(ctx.desktopDeviceId);
    if (desktopClient && desktopClient.ws.readyState === WebSocket.OPEN) {
      this.sendEnvelope(desktopClient.ws, envelope);
    }

    const androidClient = this.clients.get(ctx.androidDeviceId);
    if (androidClient && androidClient.ws.readyState === WebSocket.OPEN) {
      this.sendEnvelope(androidClient.ws, envelope);
    }
  }

  private notifyPeerDisconnection(client: AuthenticatedClient): void {
    db.getDeviceById(client.deviceId).then((device) => {
      if (device && device.pairedDeviceId) {
        const peer = this.clients.get(device.pairedDeviceId);
        if (peer && peer.ws.readyState === WebSocket.OPEN) {
          this.sendEnvelope(peer.ws, {
            eventId: uuidv4(),
            sessionId: '',
            deviceId: client.deviceId,
            timestamp: Date.now(),
            eventType: 'device:disconnected',
            payload: { isOnline: false, deviceId: client.deviceId },
          });
        }
      }
    }).catch(() => {});
  }

  private sendEnvelope(ws: WebSocket, envelope: WebSocketEnvelope): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(envelope));
    }
  }

  // Helper method for integration tests
  public getActiveSessionsCount(): number {
    return this.activeSessions.size;
  }

  public getConnectedClientsCount(): number {
    return this.clients.size;
  }

  public getSessionContext(sessionId: string): ActiveSessionContext | undefined {
    return this.activeSessions.get(sessionId);
  }
}
