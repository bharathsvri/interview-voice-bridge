import { Router } from 'express';
import {
  createSession,
  getSession,
  startSession,
  stopSession,
  deleteSession,
  createSessionSchema,
} from '../controllers/session.controller';
import { authenticate } from '../middleware/auth';
import { validateBody } from '../middleware/validate';

export const sessionRouter = Router();

sessionRouter.use(authenticate);

sessionRouter.post('/', validateBody(createSessionSchema), createSession);
sessionRouter.get('/:sessionId', getSession);
sessionRouter.post('/:sessionId/start', startSession);
sessionRouter.post('/:sessionId/stop', stopSession);
sessionRouter.delete('/:sessionId', deleteSession);
