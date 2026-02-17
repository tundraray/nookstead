import { Server } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { loadConfig } from './config';
import { ChunkRoom } from './rooms/ChunkRoom';
import { CHUNK_ROOM_NAME } from '@nookstead/shared';
import { getGameDb, closeGameDb } from '@nookstead/db/adapters/colyseus';
import { world } from './world/World';
import { chunkManager } from './world/ChunkManager';
import { sessionTracker } from './sessions';

const config = loadConfig();

// Initialize database connection
getGameDb(config.databaseUrl);
console.log('[server] Database connection initialized');

// Initialize singletons (module-level instances created on import)
// Reference them here to make initialization order explicit and verifiable.
void world;
void chunkManager;
void sessionTracker;
console.log('[Server] World, ChunkManager, and SessionTracker initialized');

const gameServer = new Server({
  transport: new WebSocketTransport({ pingInterval: 10000 }),
  express: (app) => {
    // CORS middleware
    app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', config.corsOrigin);
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.header('Access-Control-Allow-Credentials', 'true');
      if (req.method === 'OPTIONS') {
        res.sendStatus(204);
        return;
      }
      next();
    });

    // Health check endpoint
    app.get('/health', (_req, res) => {
      res.json({ status: 'ok', uptime: process.uptime() });
    });
  },
});

gameServer.define(CHUNK_ROOM_NAME, ChunkRoom).filterBy(['chunkId']);
console.log(
  `[Server] ChunkRoom registered with name: ${CHUNK_ROOM_NAME}`
);

gameServer.listen(config.port).then(() => {
  console.log(`[server] Colyseus server listening on port ${config.port}`);
});

// Graceful shutdown
async function shutdown(): Promise<void> {
  console.log('[server] Shutting down gracefully...');

  try {
    await closeGameDb();
    console.log('[server] Database connections closed');
  } catch (error) {
    console.error('[server] Error closing database connections:', error);
  }

  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
