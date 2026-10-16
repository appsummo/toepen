import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { router } from './routes.js';
import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { attachWebSocket } from './ws.js';
import { waitForDb } from './db/pool.js';
import { migrate } from './db/migrate.js';

const PORT = Number(process.env.PORT) || 3001;

async function main(): Promise<void> {
  await waitForDb();
  console.log('[toepen] database ready');
  await migrate();
  console.log('[toepen] migrations applied');

  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api', router);

  const server = http.createServer(app);
  attachWebSocket(server);

  server.listen(PORT, () => {
    console.log(`[toepen] server listening on :${PORT} (REST /api, WS /ws)`);
  });
}

main().catch((err) => {
  console.error('[toepen] fatal', err);
  process.exit(1);
});
