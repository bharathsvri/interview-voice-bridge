import { Router } from 'express';
import {
  register,
  login,
  refresh,
  logout,
  registerSchema,
  loginSchema,
  refreshSchema,
} from '../controllers/auth.controller';
import { validateBody } from '../middleware/validate';
import { authRateLimiter } from '../middleware/rateLimiter';

export const authRouter = Router();

authRouter.post('/register', authRateLimiter, validateBody(registerSchema), register);
authRouter.post('/login', authRateLimiter, validateBody(loginSchema), login);
authRouter.post('/refresh', validateBody(refreshSchema), refresh);
authRouter.post('/logout', logout);
