import { Router } from 'express';
import { authRouter } from './auth.routes';
import { deviceRouter } from './device.routes';
import { sessionRouter } from './session.routes';
import { transcriptionRouter } from './transcription.routes';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/devices', deviceRouter);
apiRouter.use('/sessions', sessionRouter);
apiRouter.use('/transcriptions', transcriptionRouter);
