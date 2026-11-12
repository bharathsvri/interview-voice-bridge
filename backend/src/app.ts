import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { v4 as uuidv4 } from 'uuid';
import { config } from './config';
import { apiRouter } from './routes';
import { healthRouter } from './routes/health.routes';
import { errorHandler } from './middleware/errorHandler';
import { apiRateLimiter } from './middleware/rateLimiter';

export const app = express();

// Security and headers
app.use(helmet());
app.use(
  cors({
    origin: config.corsOrigin === '*' ? true : config.corsOrigin,
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Assign unique Request-ID to each request
app.use((req: Request, res: Response, next: NextFunction) => {
  const reqId = (req.headers['x-request-id'] as string) || uuidv4();
  req.requestId = reqId;
  res.setHeader('X-Request-ID', reqId);
  next();
});

// Health check endpoints (exempt from rate limit)
app.use('/', healthRouter);

// Apply rate limiter to /api
app.use('/api', apiRateLimiter);

// Mount main API routes
app.use('/api/v1', apiRouter);

// Fallback 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
    requestId: req.requestId || '',
    timestamp: new Date().toISOString(),
  });
});

// Centralized error handler
app.use(errorHandler);
