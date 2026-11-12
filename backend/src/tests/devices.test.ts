import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../app';
import { db } from '../database';

describe('Device Pairing & Management Unit Tests', () => {
  let authToken: string;

  beforeEach(async () => {
    db.clearInMemory();
    const regRes = await request(app).post('/api/v1/auth/register').send({
      email: 'device@example.com',
      password: 'StrongPassword123!',
      name: 'Device Owner',
    });
    authToken = regRes.body.data.tokens.accessToken;
  });

  it('should initiate device pairing and return 6-digit code and one-time token', async () => {
    const res = await request(app)
      .post('/api/v1/devices/pair/initiate')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        deviceId: 'desktop-pc-01',
        name: 'Work Desktop',
        deviceType: 'desktop',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.pairingCode).toHaveLength(6);
    expect(res.body.data.oneTimeToken).toBeDefined();
    expect(res.body.data.qrCodeData).toBeDefined();
  });

  it('should approve pairing from an Android device and link devices', async () => {
    const initRes = await request(app)
      .post('/api/v1/devices/pair/initiate')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        deviceId: 'desktop-pc-02',
        name: 'Work Desktop',
        deviceType: 'desktop',
      });

    const pairingCode = initRes.body.data.pairingCode;

    const approveRes = await request(app)
      .post('/api/v1/devices/pair/approve')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        pairingCode,
        approvingDeviceId: 'android-phone-01',
        name: 'Pixel 8',
        deviceType: 'android',
      });

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.success).toBe(true);
    expect(approveRes.body.data.status).toBe('approved');

    // Verify devices list
    const devicesRes = await request(app)
      .get('/api/v1/devices')
      .set('Authorization', `Bearer ${authToken}`);

    expect(devicesRes.status).toBe(200);
    expect(devicesRes.body.data).toHaveLength(2);
    const desktop = devicesRes.body.data.find((d: any) => d.id === 'desktop-pc-02');
    const android = devicesRes.body.data.find((d: any) => d.id === 'android-phone-01');
    expect(desktop.pairedDeviceId).toBe('android-phone-01');
    expect(android.pairedDeviceId).toBe('desktop-pc-02');
  });

  it('should complete pairing with one-time token', async () => {
    const initRes = await request(app)
      .post('/api/v1/devices/pair/initiate')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        deviceId: 'desktop-pc-03',
        name: 'Work Desktop',
        deviceType: 'desktop',
      });

    const { pairingCode, oneTimeToken } = initRes.body.data;

    await request(app)
      .post('/api/v1/devices/pair/approve')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        pairingCode,
        approvingDeviceId: 'android-phone-02',
      });

    const completeRes = await request(app)
      .post('/api/v1/devices/pair/complete')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        pairingCode,
        oneTimeToken,
      });

    expect(completeRes.status).toBe(200);
    expect(completeRes.body.data.status).toBe('completed');
  });

  it('should reject approval with invalid code', async () => {
    const approveRes = await request(app)
      .post('/api/v1/devices/pair/approve')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        pairingCode: '000000',
        approvingDeviceId: 'android-phone-99',
      });

    expect(approveRes.status).toBe(404);
  });
});
