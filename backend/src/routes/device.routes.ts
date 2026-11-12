import { Router } from 'express';
import {
  initiatePairing,
  approvePairing,
  completePairing,
  getDevices,
  deleteDevice,
  initiatePairingSchema,
  approvePairingSchema,
  completePairingSchema,
} from '../controllers/device.controller';
import { authenticate } from '../middleware/auth';
import { validateBody } from '../middleware/validate';

export const deviceRouter = Router();

deviceRouter.use(authenticate);

deviceRouter.post('/pair/initiate', validateBody(initiatePairingSchema), initiatePairing);
deviceRouter.post('/pair/approve', validateBody(approvePairingSchema), approvePairing);
deviceRouter.post('/pair/complete', validateBody(completePairingSchema), completePairing);
deviceRouter.get('/', getDevices);
deviceRouter.delete('/:deviceId', deleteDevice);
