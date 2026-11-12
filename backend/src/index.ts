import http from 'http';
import { app } from './app';
import { config } from './config';
import { logger } from './utils/logger';
import { db } from './database';
import { WebSocketGateway } from './websocket/gateway';

const server = http.createServer(app);
export const gateway = new WebSocketGateway(server);

async function start() {
  try {
    await db.connect();

    server.listen(config.port, () => {
      logger.info(
        `Server running on http://localhost:${config.port} [env: ${config.nodeEnv}]`
      );
      logger.info(`WebSocket gateway active on ws://localhost:${config.port}/ws`);
    });
  } catch (err: any) {
    logger.error({ err: err.message }, 'Failed to start server');
    process.exit(1);
  }
}

// Graceful shutdown handling
function handleShutdown(signal: string) {
  logger.info({ signal }, 'Shutdown signal received. Closing gracefully...');
  gateway.close();
  server.close(async () => {
    logger.info('HTTP server closed');
    await db.disconnect();
    logger.info('Database disconnected. Process terminating.');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Graceful shutdown timed out. Forcefully terminating.');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

if (process.env.NODE_ENV !== 'test') {
  start();
}
