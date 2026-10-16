import http from 'node:http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { router } from './routes.js';
import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { attachWebSocket } from './ws.js';
import { waitForDb, pool } from './db/pool.js';
import { migrate } from './db/migrate.js';
import { apiLimiter, authLimiter, corsOptions } from './security.js';

const PORT = Number(process.env.PORT) || 3001;

// Behind Caddy -> nginx the client IP arrives in X-Forwarded-For. Express must
// be told how many proxies to trust, or rate limiting would key every request
// to the proxy's address and throttle all players as one.
const TRUST_PROXY_HOPS = Number(process.env.TRUST_PROXY_HOPS ?? 0);

async function main(): Promise<void> {
  await waitForDb();
  console.log('[toepen] database ready');
  await migrate();
  console.log('[toepen] migrations applied');

  const app = express();
  app.set('trust proxy', TRUST_PROXY_HOPS);
  // The API serves JSON only; the SPA is served by nginx, so a strict default
  // CSP here would only ever apply to API responses.
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.use(cors(corsOptions()));
  app.use(express.json({ limit: '64kb' }));
  app.use('/api', apiLimiter);
  app.use('/api/auth', authLimiter, authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api', router);

  const server = http.createServer(app);
  attachWebSocket(server);

  server.listen(PORT, () => {
    console.log(`[toepen] server listening on :${PORT} (REST /api, WS /ws)`);
  });

  // Finish in-flight requests and close the pool so a redeploy does not cut
  // players off mid-action or leave Postgres connections dangling.
  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[toepen] ${signal} received, shutting down`);
    server.close(() => {
      pool.end().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('[toepen] fatal', err);
  process.exit(1);
});
