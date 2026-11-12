import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../app';
import { db } from '../database';
import { signAccessToken, verifyAccessToken } from '../auth/jwt';

describe('Authentication API & JWT Unit Tests', () => {
  beforeEach(() => {
    db.clearInMemory();
  });

  it('should successfully register a new user and return tokens', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      email: 'test@example.com',
      password: 'StrongPassword123!',
      name: 'Test Candidate',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('test@example.com');
    expect(res.body.data.tokens.accessToken).toBeDefined();
    expect(res.body.data.tokens.refreshToken).toBeDefined();
  });

  it('should reject registration if email already exists', async () => {
    await request(app).post('/api/v1/auth/register').send({
      email: 'dup@example.com',
      password: 'StrongPassword123!',
      name: 'Candidate One',
    });

    const res = await request(app).post('/api/v1/auth/register').send({
      email: 'dup@example.com',
      password: 'AnotherPassword123!',
      name: 'Candidate Two',
    });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
  });

  it('should login an existing user with valid credentials', async () => {
    await request(app).post('/api/v1/auth/register').send({
      email: 'login@example.com',
      password: 'ValidPassword123!',
      name: 'Login User',
    });

    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'login@example.com',
      password: 'ValidPassword123!',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.tokens.accessToken).toBeDefined();
  });

  it('should reject login with wrong password', async () => {
    await request(app).post('/api/v1/auth/register').send({
      email: 'wrongpass@example.com',
      password: 'ValidPassword123!',
      name: 'User',
    });

    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'wrongpass@example.com',
      password: 'IncorrectPassword',
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('should refresh tokens and rotate refresh token', async () => {
    const regRes = await request(app).post('/api/v1/auth/register').send({
      email: 'refresh@example.com',
      password: 'ValidPassword123!',
      name: 'Refresh User',
    });

    const originalRefreshToken = regRes.body.data.tokens.refreshToken;

    const refreshRes = await request(app).post('/api/v1/auth/refresh').send({
      refreshToken: originalRefreshToken,
    });

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.data.accessToken).toBeDefined();
    expect(refreshRes.body.data.refreshToken).toBeDefined();
    expect(refreshRes.body.data.refreshToken).not.toBe(originalRefreshToken);

    // Old refresh token must now be revoked
    const reusedRes = await request(app).post('/api/v1/auth/refresh').send({
      refreshToken: originalRefreshToken,
    });
    expect(reusedRes.status).toBe(401);
  });

  it('should verify JWT tokens accurately', () => {
    const payload = { userId: 'usr-123', email: 'jwt@example.com' };
    const token = signAccessToken(payload);
    const decoded = verifyAccessToken(token);

    expect(decoded.userId).toBe('usr-123');
    expect(decoded.email).toBe('jwt@example.com');
  });
});
