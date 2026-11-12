import { WebSocketEnvelope, WebSocketEventType } from '@interview-voice-bridge/shared-types';

export type WebSocketListener = (envelope: WebSocketEnvelope) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string = 'ws://localhost:5000/ws';
  private listeners: Map<WebSocketEventType | '*', Set<WebSocketListener>> = new Map();
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private token: string | null = null;
  private deviceId: string = 'desktop-default';
  private isExplicitlyClosed = false;

  public connect(url: string, token: string, deviceId: string): void {
    this.url = url;
    this.token = token;
    this.deviceId = deviceId;
    this.isExplicitlyClosed = false;
    this.initSocket();
  }

  private initSocket(): void {
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {
        // ignore
      }
    }

    const wsUrl = `${this.url}?token=${encodeURIComponent(this.token || '')}&deviceId=${encodeURIComponent(
      this.deviceId
    )}&deviceType=desktop`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.startHeartbeat();
      this.emitLocal('connection:reconnect', { connected: true });
    };

    this.ws.onmessage = (event) => {
      try {
        const envelope: WebSocketEnvelope = JSON.parse(event.data);
        this.notify(envelope);
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };

    this.ws.onclose = () => {
      this.stopHeartbeat();
      this.emitLocal('device:disconnected', { isOnline: false });
      if (!this.isExplicitlyClosed) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (err) => {
      console.error('Desktop WebSocket error:', err);
    };
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected()) {
        this.send('connection:heartbeat', '', {
          sequence: Date.now(),
          clientTimestamp: Date.now(),
        });
      }
    }, 25000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || this.reconnectAttempts >= this.maxReconnectAttempts) return;

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 15000);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.initSocket();
    }, delay);
  }

  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  public send<T = any>(eventType: WebSocketEventType, sessionId: string, payload: T): void {
    if (!this.isConnected()) return;

    const envelope: WebSocketEnvelope<T> = {
      eventId: Math.random().toString(36).substring(2, 11),
      sessionId,
      deviceId: this.deviceId,
      timestamp: Date.now(),
      eventType,
      payload,
    };

    this.ws!.send(JSON.stringify(envelope));
  }

  public sendBinary(chunk: ArrayBuffer): void {
    if (!this.isConnected()) return;
    this.ws!.send(chunk);
  }

  public subscribe(eventType: WebSocketEventType | '*', listener: WebSocketListener): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(listener);

    return () => {
      this.listeners.get(eventType)?.delete(listener);
    };
  }

  private notify(envelope: WebSocketEnvelope): void {
    const specific = this.listeners.get(envelope.eventType);
    if (specific) {
      specific.forEach((l) => l(envelope));
    }
    const wildcard = this.listeners.get('*');
    if (wildcard) {
      wildcard.forEach((l) => l(envelope));
    }
  }

  private emitLocal(eventType: WebSocketEventType, payload: any): void {
    this.notify({
      eventId: 'local',
      sessionId: '',
      deviceId: this.deviceId,
      timestamp: Date.now(),
      eventType,
      payload,
    });
  }

  public disconnect(): void {
    this.isExplicitlyClosed = true;
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const wsClient = new WebSocketClient();
