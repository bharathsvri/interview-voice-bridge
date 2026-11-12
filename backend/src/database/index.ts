import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeviceRecord {
  id: string;
  userId: string;
  name: string;
  deviceType: 'desktop' | 'android';
  model?: string;
  osVersion?: string;
  pairedDeviceId?: string;
  isOnline: boolean;
  lastActiveAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface DevicePairingRecord {
  id: string;
  userId: string;
  initiatingDeviceId: string;
  pairedDeviceId?: string;
  pairingCode: string;
  oneTimeToken: string;
  status: 'pending' | 'approved' | 'expired' | 'revoked';
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionRecord {
  id: string;
  userId: string;
  desktopDeviceId: string;
  androidDeviceId: string;
  status: 'active' | 'completed' | 'cancelled';
  isPersistenceEnabled: boolean;
  startedAt: Date;
  endedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface TranscriptSegmentRecord {
  id: string;
  sessionId: string;
  sequenceNumber: number;
  text: string;
  isFinal: boolean;
  timestamp: number;
  confidence: number;
  language: string;
  createdAt: Date;
}

export interface RefreshTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revoked: boolean;
  createdAt: Date;
}

/**
 * Universal Database Manager
 * Supports Prisma PostgreSQL with resilient in-memory fallback for testing and offline environments.
 */
class DatabaseManager {
  private prisma: PrismaClient | null = null;
  private useInMemory = true; // Default to true unless DB connected or explicitly initialized

  // In-Memory store tables
  private users: Map<string, UserRecord> = new Map();
  private devices: Map<string, DeviceRecord> = new Map();
  private pairings: Map<string, DevicePairingRecord> = new Map();
  private sessions: Map<string, SessionRecord> = new Map();
  private segments: Map<string, TranscriptSegmentRecord> = new Map();
  private refreshTokens: Map<string, RefreshTokenRecord> = new Map();

  constructor() {
    if (process.env.NODE_ENV !== 'test' && process.env.DATABASE_URL) {
      try {
        this.prisma = new PrismaClient();
      } catch (err) {
        logger.warn({ err }, 'PrismaClient init failed; using in-memory store');
        this.useInMemory = true;
      }
    } else {
      this.useInMemory = true;
    }
  }

  public async connect(): Promise<void> {
    if (this.prisma && !this.useInMemory) {
      try {
        await this.prisma.$connect();
        logger.info('Database connected successfully via Prisma');
      } catch (err) {
        logger.warn('Could not connect to PostgreSQL via Prisma. Falling back to in-memory store.');
        this.useInMemory = true;
      }
    }
  }

  public async disconnect(): Promise<void> {
    if (this.prisma) {
      await this.prisma.$disconnect().catch(() => {});
    }
  }

  public clearInMemory(): void {
    this.users.clear();
    this.devices.clear();
    this.pairings.clear();
    this.sessions.clear();
    this.segments.clear();
    this.refreshTokens.clear();
  }

  // ==================== User Repository ====================
  public async createUser(data: { email: string; passwordHash: string; name: string }): Promise<UserRecord> {
    if (!this.useInMemory && this.prisma) {
      return (await this.prisma.user.create({ data })) as unknown as UserRecord;
    }
    const existing = Array.from(this.users.values()).find((u) => u.email === data.email);
    if (existing) {
      throw new Error('User already exists');
    }
    const user: UserRecord = {
      id: uuidv4(),
      email: data.email,
      passwordHash: data.passwordHash,
      name: data.name,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(user.id, user);
    return user;
  }

  public async findUserByEmail(email: string): Promise<UserRecord | null> {
    if (!this.useInMemory && this.prisma) {
      return (await this.prisma.user.findUnique({ where: { email } })) as unknown as UserRecord | null;
    }
    const user = Array.from(this.users.values()).find((u) => u.email === email);
    return user || null;
  }

  public async findUserById(id: string): Promise<UserRecord | null> {
    if (!this.useInMemory && this.prisma) {
      return (await this.prisma.user.findUnique({ where: { id } })) as unknown as UserRecord | null;
    }
    return this.users.get(id) || null;
  }

  // ==================== Refresh Token Repository ====================
  public async createRefreshToken(data: { userId: string; tokenHash: string; expiresAt: Date }): Promise<RefreshTokenRecord> {
    if (!this.useInMemory && this.prisma) {
      return (await this.prisma.refreshToken.create({ data })) as unknown as RefreshTokenRecord;
    }
    const record: RefreshTokenRecord = {
      id: uuidv4(),
      userId: data.userId,
      tokenHash: data.tokenHash,
      expiresAt: data.expiresAt,
      revoked: false,
      createdAt: new Date(),
    };
    this.refreshTokens.set(record.id, record);
    return record;
  }

  public async findRefreshToken(tokenHash: string): Promise<RefreshTokenRecord | null> {
    if (!this.useInMemory && this.prisma) {
      return (await this.prisma.refreshToken.findUnique({ where: { tokenHash } })) as unknown as RefreshTokenRecord | null;
    }
    const token = Array.from(this.refreshTokens.values()).find((t) => t.tokenHash === tokenHash);
    return token || null;
  }

  public async revokeRefreshToken(tokenHash: string): Promise<void> {
    if (!this.useInMemory && this.prisma) {
      await this.prisma.refreshToken.update({
        where: { tokenHash },
        data: { revoked: true },
      });
      return;
    }
    const token = Array.from(this.refreshTokens.values()).find((t) => t.tokenHash === tokenHash);
    if (token) {
      token.revoked = true;
    }
  }

  // ==================== Device Repository ====================
  public async upsertDevice(data: {
    id?: string;
    userId: string;
    name: string;
    deviceType: 'desktop' | 'android';
    model?: string;
    osVersion?: string;
  }): Promise<DeviceRecord> {
    const id = data.id || uuidv4();
    if (!this.useInMemory && this.prisma) {
      return (await this.prisma.device.upsert({
        where: { id },
        create: {
          id,
          userId: data.userId,
          name: data.name,
          deviceType: data.deviceType,
          model: data.model,
          osVersion: data.osVersion,
          isOnline: true,
          lastActiveAt: new Date(),
        },
        update: {
          name: data.name,
          model: data.model,
          osVersion: data.osVersion,
          isOnline: true,
          lastActiveAt: new Date(),
        },
      })) as unknown as DeviceRecord;
    }

    let existing = this.devices.get(id);
    if (existing) {
      existing.name = data.name;
      existing.model = data.model;
      existing.osVersion = data.osVersion;
      existing.isOnline = true;
      existing.lastActiveAt = new Date();
      existing.updatedAt = new Date();
      return existing;
    }

    const newDevice: DeviceRecord = {
      id,
      userId: data.userId,
      name: data.name,
      deviceType: data.deviceType,
      model: data.model,
      osVersion: data.osVersion,
      isOnline: true,
      lastActiveAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.devices.set(id, newDevice);
    return newDevice;
  }

  public async getDeviceById(id: string): Promise<DeviceRecord | null> {
    if (!this.useInMemory && this.prisma) {
      return (await this.prisma.device.findUnique({ where: { id } })) as unknown as DeviceRecord | null;
    }
    return this.devices.get(id) || null;
  }

  public async getDevicesByUserId(userId: string): Promise<DeviceRecord[]> {
    if (!this.useInMemory && this.prisma) {
      return (await this.prisma.device.findMany({ where: { userId } })) as unknown as DeviceRecord[];
    }
    return Array.from(this.devices.values()).filter((d) => d.userId === userId);
  }

  public async updateDeviceStatus(id: string, isOnline: boolean): Promise<void> {
    if (!this.useInMemory && this.prisma) {
      await this.prisma.device.update({
        where: { id },
        data: { isOnline, lastActiveAt: new Date() },
      });
      return;
    }
    const dev = this.devices.get(id);
    if (dev) {
      dev.isOnline = isOnline;
      dev.lastActiveAt = new Date();
    }
  }

  public async pairDevices(desktopDeviceId: string, androidDeviceId: string): Promise<void> {
    if (!this.useInMemory && this.prisma) {
      await this.prisma.device.update({
        where: { id: desktopDeviceId },
        data: { pairedDeviceId: androidDeviceId },
      });
      await this.prisma.device.update({
        where: { id: androidDeviceId },
        data: { pairedDeviceId: desktopDeviceId },
      });
      return;
    }
    const desktop = this.devices.get(desktopDeviceId);
    const android = this.devices.get(androidDeviceId);
    if (desktop) desktop.pairedDeviceId = androidDeviceId;
    if (android) android.pairedDeviceId = desktopDeviceId;
  }

  public async unpairDevice(deviceId: string): Promise<void> {
    if (!this.useInMemory && this.prisma) {
      const dev = await this.prisma.device.findUnique({ where: { id: deviceId } });
      if (dev && dev.pairedDeviceId) {
        await this.prisma.device.update({
          where: { id: dev.pairedDeviceId },
          data: { pairedDeviceId: null },
        });
      }
      await this.prisma.device.update({
        where: { id: deviceId },
        data: { pairedDeviceId: null },
      });
      return;
    }
    const dev = this.devices.get(deviceId);
    if (dev && dev.pairedDeviceId) {
      const other = this.devices.get(dev.pairedDeviceId);
      if (other) other.pairedDeviceId = undefined;
      dev.pairedDeviceId = undefined;
    }
  }

  public async deleteDevice(deviceId: string): Promise<void> {
    await this.unpairDevice(deviceId);
    if (!this.useInMemory && this.prisma) {
      await this.prisma.device.delete({ where: { id: deviceId } });
      return;
    }
    this.devices.delete(deviceId);
  }

  // ==================== Pairing Repository ====================
  public async createPairing(data: {
    userId: string;
    initiatingDeviceId: string;
    pairingCode: string;
    oneTimeToken: string;
    expiresAt: Date;
  }): Promise<DevicePairingRecord> {
    if (!this.useInMemory && this.prisma) {
      return (await this.prisma.devicePairing.create({ data })) as unknown as DevicePairingRecord;
    }
    const record: DevicePairingRecord = {
      id: uuidv4(),
      userId: data.userId,
      initiatingDeviceId: data.initiatingDeviceId,
      pairingCode: data.pairingCode,
      oneTimeToken: data.oneTimeToken,
      status: 'pending',
      expiresAt: data.expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.pairings.set(record.id, record);
    return record;
  }

  public async findPairingByCode(pairingCode: string): Promise<DevicePairingRecord | null> {
    if (!this.useInMemory && this.prisma) {
      return (await this.prisma.devicePairing.findUnique({ where: { pairingCode } })) as unknown as DevicePairingRecord | null;
    }
    const pairing = Array.from(this.pairings.values()).find((p) => p.pairingCode === pairingCode);
    return pairing || null;
  }

  public async updatePairingStatus(
    id: string,
    status: 'pending' | 'approved' | 'expired' | 'revoked',
    pairedDeviceId?: string
  ): Promise<void> {
    if (!this.useInMemory && this.prisma) {
      await this.prisma.devicePairing.update({
        where: { id },
        data: {
          status,
          pairedDeviceId: pairedDeviceId || undefined,
        },
      });
      return;
    }
    const pairing = this.pairings.get(id);
    if (pairing) {
      pairing.status = status;
      if (pairedDeviceId) pairing.pairedDeviceId = pairedDeviceId;
      pairing.updatedAt = new Date();
    }
  }

  // ==================== Session Repository ====================
  public async createSession(data: {
    userId: string;
    desktopDeviceId: string;
    androidDeviceId: string;
    isPersistenceEnabled?: boolean;
  }): Promise<SessionRecord> {
    if (!this.useInMemory && this.prisma) {
      return (await this.prisma.transcriptionSession.create({
        data: {
          userId: data.userId,
          desktopDeviceId: data.desktopDeviceId,
          androidDeviceId: data.androidDeviceId,
          isPersistenceEnabled: data.isPersistenceEnabled ?? true,
          status: 'active',
        },
      })) as unknown as SessionRecord;
    }
    const session: SessionRecord = {
      id: uuidv4(),
      userId: data.userId,
      desktopDeviceId: data.desktopDeviceId,
      androidDeviceId: data.androidDeviceId,
      status: 'active',
      isPersistenceEnabled: data.isPersistenceEnabled ?? true,
      startedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.sessions.set(session.id, session);
    return session;
  }

  public async getSessionById(id: string): Promise<SessionRecord | null> {
    if (!this.useInMemory && this.prisma) {
      return (await this.prisma.transcriptionSession.findUnique({ where: { id } })) as unknown as SessionRecord | null;
    }
    return this.sessions.get(id) || null;
  }

  public async updateSessionStatus(id: string, status: 'active' | 'completed' | 'cancelled'): Promise<void> {
    const endedAt = status !== 'active' ? new Date() : undefined;
    if (!this.useInMemory && this.prisma) {
      await this.prisma.transcriptionSession.update({
        where: { id },
        data: { status, endedAt },
      });
      return;
    }
    const session = this.sessions.get(id);
    if (session) {
      session.status = status;
      if (endedAt) session.endedAt = endedAt;
      session.updatedAt = new Date();
    }
  }

  public async deleteSession(id: string): Promise<void> {
    if (!this.useInMemory && this.prisma) {
      await this.prisma.transcriptionSession.delete({ where: { id } });
      return;
    }
    this.sessions.delete(id);
    // Delete segments belonging to this session
    for (const [key, seg] of this.segments.entries()) {
      if (seg.sessionId === id) {
        this.segments.delete(key);
      }
    }
  }

  // ==================== Transcript Segments Repository ====================
  public async createSegment(data: {
    sessionId: string;
    sequenceNumber: number;
    text: string;
    isFinal: boolean;
    timestamp: number;
    confidence?: number;
    language?: string;
  }): Promise<TranscriptSegmentRecord> {
    const session = await this.getSessionById(data.sessionId);
    if (session && !session.isPersistenceEnabled) {
      // Ephemeral segment, don't store in DB if persistence disabled
      return {
        id: uuidv4(),
        sessionId: data.sessionId,
        sequenceNumber: data.sequenceNumber,
        text: data.text,
        isFinal: data.isFinal,
        timestamp: data.timestamp,
        confidence: data.confidence ?? 1.0,
        language: data.language ?? 'en',
        createdAt: new Date(),
      };
    }

    if (!this.useInMemory && this.prisma) {
      return (await this.prisma.transcriptSegment.create({
        data: {
          sessionId: data.sessionId,
          sequenceNumber: data.sequenceNumber,
          text: data.text,
          isFinal: data.isFinal,
          timestamp: BigInt(data.timestamp),
          confidence: data.confidence ?? 1.0,
          language: data.language ?? 'en',
        },
      })) as unknown as TranscriptSegmentRecord;
    }

    const seg: TranscriptSegmentRecord = {
      id: uuidv4(),
      sessionId: data.sessionId,
      sequenceNumber: data.sequenceNumber,
      text: data.text,
      isFinal: data.isFinal,
      timestamp: data.timestamp,
      confidence: data.confidence ?? 1.0,
      language: data.language ?? 'en',
      createdAt: new Date(),
    };
    this.segments.set(seg.id, seg);
    return seg;
  }

  public async getSegmentsBySessionId(sessionId: string): Promise<TranscriptSegmentRecord[]> {
    if (!this.useInMemory && this.prisma) {
      const records: any[] = await this.prisma.transcriptSegment.findMany({
        where: { sessionId },
        orderBy: { sequenceNumber: 'asc' },
      });
      return records.map((r: any) => ({
        ...r,
        timestamp: Number(r.timestamp),
      })) as unknown as TranscriptSegmentRecord[];
    }
    return Array.from(this.segments.values())
      .filter((s) => s.sessionId === sessionId)
      .sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  }

  public async deleteSegmentsBySessionId(sessionId: string): Promise<void> {
    if (!this.useInMemory && this.prisma) {
      await this.prisma.transcriptSegment.deleteMany({ where: { sessionId } });
      return;
    }
    for (const [key, seg] of this.segments.entries()) {
      if (seg.sessionId === sessionId) {
        this.segments.delete(key);
      }
    }
  }
}

export const db = new DatabaseManager();
