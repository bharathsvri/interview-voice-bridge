import { Router } from 'express';
import { getHealth, getReady } from '../controllers/health.controller';

export const healthRouter = Router();

healthRouter.get('/health', getHealth);
healthRouter.get('/ready', getReady);
