import { Router } from 'express';
import { getTranscriptions, deleteTranscriptions } from '../controllers/transcription.controller';
import { authenticate } from '../middleware/auth';

export const transcriptionRouter = Router();

transcriptionRouter.use(authenticate);

transcriptionRouter.get('/:sessionId', getTranscriptions);
transcriptionRouter.delete('/:sessionId', deleteTranscriptions);
