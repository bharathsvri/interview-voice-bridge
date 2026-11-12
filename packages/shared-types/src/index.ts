/**
 * Shared Type Definitions for Interview Voice Bridge
 */

// ==================== User & Auth ====================
export interface UserProfile {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
}

export interface AuthResponse {
  user: UserProfile;
  tokens: AuthTokens;
}

// ==================== Devices ====================
export type DeviceType = 'desktop' | 'android';

export interface DeviceInfo {
  id: string;
  userId: string;
  name: string;
  deviceType: DeviceType;
  model?: string;
  osVersion?: string;
  pairedDeviceId?: string;
  isOnline: boolean;
  lastActiveAt: string;
  createdAt: string;
}

export type PairingStatus = 'pending' | 'approved' | 'expired' | 'revoked';

export interface InitiatePairingResponse {
  pairingCode: string;
  qrCodeData: string;
  expiresAt: string;
  expiresInSeconds: number;
  oneTimeToken: string;
}

export interface PairingInfo {
  id: string;
  initiatingDeviceId: string;
  pairedDeviceId?: string;
  status: PairingStatus;
  expiresAt: string;
}

// ==================== Sessions ====================
export type SessionStatus = 'active' | 'completed' | 'cancelled';

export interface SessionInfo {
  id: string;
  userId: string;
  desktopDeviceId: string;
  androidDeviceId: string;
  status: SessionStatus;
  startedAt: string;
  endedAt?: string;
  isPersistenceEnabled: boolean;
  metadata?: Record<string, unknown>;
}

// ==================== Transcripts ====================
export interface TranscriptSegment {
  id: string;
  sessionId: string;
  sequenceNumber: number;
  text: string;
  isFinal: boolean;
  timestamp: number; // unix ms
  confidence: number;
  language: string;
}

export interface SessionTranscriptSummary {
  sessionId: string;
  segments: TranscriptSegment[];
  totalSegments: number;
  fullFinalText: string;
}

// ==================== WebSocket Events ====================
export type WebSocketEventType =
  | 'desktop:connect'
  | 'desktop:audio:start'
  | 'desktop:audio:chunk'
  | 'desktop:audio:stop'
  | 'android:connect'
  | 'android:transcription:subscribe'
  | 'android:transcription:unsubscribe'
  | 'transcription:interim'
  | 'transcription:final'
  | 'transcription:error'
  | 'session:started'
  | 'session:stopped'
  | 'device:connected'
  | 'device:disconnected'
  | 'connection:heartbeat'
  | 'connection:reconnect';

export interface WebSocketEnvelope<T = unknown> {
  eventId: string;
  sessionId: string;
  deviceId: string;
  timestamp: number;
  eventType: WebSocketEventType;
  payload: T;
}

// Event Payload Definitions
export interface DesktopConnectPayload {
  token: string;
  deviceId: string;
  audioConfig?: {
    sampleRate: number;
    encoding: 'linear16' | 'opus' | 'webm';
    channels: number;
  };
}

export interface DesktopAudioStartPayload {
  sessionId: string;
  sampleRate: number;
  channels: number;
  language?: string;
}

export interface DesktopAudioChunkPayload {
  sessionId: string;
  chunkIndex: number;
  audioBase64: string; // or binary frame
  timestamp: number;
}

export interface DesktopAudioStopPayload {
  sessionId: string;
}

export interface AndroidConnectPayload {
  token: string;
  deviceId: string;
}

export interface AndroidSubscribePayload {
  sessionId: string;
}

export interface AndroidUnsubscribePayload {
  sessionId: string;
}

export interface TranscriptionInterimPayload {
  sessionId: string;
  text: string;
  isFinal: false;
  timestamp: number;
  sequenceNumber: number;
  confidence: number;
  language: string;
}

export interface TranscriptionFinalPayload {
  sessionId: string;
  segmentId: string;
  text: string;
  isFinal: true;
  timestamp: number;
  sequenceNumber: number;
  confidence: number;
  language: string;
}

export interface TranscriptionErrorPayload {
  sessionId: string;
  code: string;
  message: string;
  recoverable: boolean;
}

export interface SessionStatusPayload {
  sessionId: string;
  status: SessionStatus;
  desktopDeviceId: string;
  androidDeviceId: string;
  timestamp: number;
}

export interface DeviceStatusPayload {
  deviceId: string;
  deviceType: DeviceType;
  isOnline: boolean;
  pairedDeviceId?: string;
}

export interface HeartbeatPayload {
  sequence: number;
  clientTimestamp: number;
  serverTimestamp?: number;
}

export interface ReconnectPayload {
  token: string;
  deviceId: string;
  lastEventId?: string;
  sessionId?: string;
}

// ==================== REST Request & Response DTOs ====================
export interface RegisterDto {
  email: string;
  password: string;
  name: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface RefreshDto {
  refreshToken: string;
}

export interface InitiatePairingDto {
  deviceId: string;
}

export interface ApprovePairingDto {
  pairingCode: string;
  targetDeviceId: string; // the device approving or pairing with
}

export interface CompletePairingDto {
  pairingCode: string;
  oneTimeToken: string;
}

export interface CreateSessionDto {
  desktopDeviceId: string;
  androidDeviceId: string;
  isPersistenceEnabled?: boolean;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  requestId: string;
  timestamp: string;
}
