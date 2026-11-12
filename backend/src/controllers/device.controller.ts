import { Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../database';
import { generatePairingCode, generateOneTimeToken } from '../utils/crypto';
import { config } from '../config';

export const initiatePairingSchema = z.object({
  deviceId: z.string().min(1),
  name: z.string().optional(),
  deviceType: z.enum(['desktop', 'android']).optional(),
});

export const approvePairingSchema = z.object({
  pairingCode: z.string().length(6),
  approvingDeviceId: z.string().min(1),
  name: z.string().optional(),
  deviceType: z.enum(['desktop', 'android']).optional(),
});

export const completePairingSchema = z.object({
  pairingCode: z.string().length(6),
  oneTimeToken: z.string().min(1),
});

export async function initiatePairing(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { deviceId, name, deviceType } = req.body;

  // Upsert initiating device
  await db.upsertDevice({
    id: deviceId,
    userId,
    name: name || 'Computer Desktop',
    deviceType: deviceType || 'desktop',
  });

  const pairingCode = generatePairingCode();
  const oneTimeToken = generateOneTimeToken();
  const expiresInSeconds = config.pairingCodeExpirationSeconds;
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

  await db.createPairing({
    userId,
    initiatingDeviceId: deviceId,
    pairingCode,
    oneTimeToken,
    expiresAt,
  });

  const qrCodeData = JSON.stringify({
    pairingCode,
    oneTimeToken,
    initiatingDeviceId: deviceId,
    expiresAt: expiresAt.toISOString(),
  });

  res.status(200).json({
    success: true,
    data: {
      pairingCode,
      qrCodeData,
      expiresAt: expiresAt.toISOString(),
      expiresInSeconds,
      oneTimeToken,
    },
    requestId: req.requestId || '',
    timestamp: new Date().toISOString(),
  });
}

export async function approvePairing(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { pairingCode, approvingDeviceId, name, deviceType } = req.body;

  const pairing = await db.findPairingByCode(pairingCode);
  if (!pairing) {
    res.status(404).json({
      success: false,
      error: { code: 'PAIRING_NOT_FOUND', message: 'Invalid pairing code' },
      requestId: req.requestId || '',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (pairing.userId !== userId) {
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Pairing does not belong to authenticated user' },
      requestId: req.requestId || '',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (new Date() > pairing.expiresAt) {
    await db.updatePairingStatus(pairing.id, 'expired');
    res.status(410).json({
      success: false,
      error: { code: 'PAIRING_EXPIRED', message: 'Pairing code has expired' },
      requestId: req.requestId || '',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (pairing.status !== 'pending') {
    res.status(400).json({
      success: false,
      error: { code: 'PAIRING_INVALID_STATE', message: `Pairing is already ${pairing.status}` },
      requestId: req.requestId || '',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Ensure approving device exists
  await db.upsertDevice({
    id: approvingDeviceId,
    userId,
    name: name || 'Android Device',
    deviceType: deviceType || 'android',
  });

  // Pair devices together
  await db.pairDevices(pairing.initiatingDeviceId, approvingDeviceId);
  await db.updatePairingStatus(pairing.id, 'approved', approvingDeviceId);

  res.status(200).json({
    success: true,
    data: {
      pairingId: pairing.id,
      initiatingDeviceId: pairing.initiatingDeviceId,
      pairedDeviceId: approvingDeviceId,
      status: 'approved',
    },
    requestId: req.requestId || '',
    timestamp: new Date().toISOString(),
  });
}

export async function completePairing(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { pairingCode, oneTimeToken } = req.body;

  const pairing = await db.findPairingByCode(pairingCode);
  if (!pairing) {
    res.status(404).json({
      success: false,
      error: { code: 'PAIRING_NOT_FOUND', message: 'Invalid pairing code' },
      requestId: req.requestId || '',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (pairing.userId !== userId || pairing.oneTimeToken !== oneTimeToken) {
    res.status(403).json({
      success: false,
      error: { code: 'UNAUTHORIZED_PAIRING', message: 'Invalid pairing credentials' },
      requestId: req.requestId || '',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (pairing.status !== 'approved') {
    res.status(400).json({
      success: false,
      error: { code: 'PAIRING_NOT_APPROVED', message: `Pairing status is ${pairing.status}` },
      requestId: req.requestId || '',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  res.status(200).json({
    success: true,
    data: {
      pairingId: pairing.id,
      initiatingDeviceId: pairing.initiatingDeviceId,
      pairedDeviceId: pairing.pairedDeviceId,
      status: 'completed',
    },
    requestId: req.requestId || '',
    timestamp: new Date().toISOString(),
  });
}

export async function getDevices(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const devices = await db.getDevicesByUserId(userId);

  res.status(200).json({
    success: true,
    data: devices.map((d) => ({
      id: d.id,
      name: d.name,
      deviceType: d.deviceType,
      model: d.model,
      osVersion: d.osVersion,
      pairedDeviceId: d.pairedDeviceId,
      isOnline: d.isOnline,
      lastActiveAt: d.lastActiveAt.toISOString(),
      createdAt: d.createdAt.toISOString(),
    })),
    requestId: req.requestId || '',
    timestamp: new Date().toISOString(),
  });
}

export async function deleteDevice(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { deviceId } = req.params;

  const device = await db.getDeviceById(deviceId);
  if (!device || device.userId !== userId) {
    res.status(404).json({
      success: false,
      error: { code: 'DEVICE_NOT_FOUND', message: 'Device not found' },
      requestId: req.requestId || '',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  await db.deleteDevice(deviceId);

  res.status(200).json({
    success: true,
    data: { message: 'Device deleted and unpaired successfully' },
    requestId: req.requestId || '',
    timestamp: new Date().toISOString(),
  });
}
